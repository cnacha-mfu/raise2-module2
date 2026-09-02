/**
 * AI Proxy สำหรับหลักสูตร RAISE 2 เดือนที่ 2
 * -------------------------------------------------------------
 * ทำหน้าที่: ถือ OpenRouter API key แทนผู้เรียน · ตรวจโทเคนประจำตัว ·
 *           จำกัดโควตารายวันต่อคน · สลับโมเดลสำรอง · มีโหมดสาธิตเมื่อ AI ล่ม
 *
 * รันบน Cloudflare Workers (ฟรี ไม่ต้องผูกบัตร)
 * ต้องมี KV namespace ผูกไว้ในชื่อ PROXY
 * ต้องมี secret ชื่อ OPENROUTER_KEY
 */

// ───────── ตั้งค่าที่ผู้สอนแก้ได้ ─────────

// ⚠️ ตรวจสอบว่าโมเดลนี้ใช้ได้จริงในเช้าวันสอน แล้วค่อยเริ่มคาบ
const PRIMARY_MODEL  = 'openai/gpt-4o-mini'      // โมเดลหลัก (แนะนำแบบเสียเงินราคาถูกสำหรับห้องใหญ่)
const FALLBACK_MODEL = 'google/gemini-2.5-flash-lite'  // โมเดลสำรอง ใช้เมื่อตัวหลักล่ม (ตรวจใช้งานได้ 2 ก.ย. 2569)

const DAILY_LIMIT      = 60      // จำนวนครั้งต่อคนต่อวัน
const MAX_INPUT_CHARS  = 4000    // กันผู้เรียนส่งข้อความยาวเกินจนเปลืองโทเคน
const MAX_OUTPUT_TOKENS = 300    // จำกัดความยาวคำตอบ

// เว็บที่อนุญาตให้เรียก (โดเมนของ Firebase Hosting + ตอนรันในเครื่อง)
const ALLOWED_ORIGINS = [
  /^https:\/\/[a-z0-9-]+\.web\.app$/,
  /^https:\/\/[a-z0-9-]+\.firebaseapp\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
]

// คำตอบสำรองเมื่อ AI ล่มทั้งสองตัว — เพื่อให้ Lab เดินต่อได้
const DEMO_REPLY = 'ลาพักร้อน'

// ───────── โค้ดหลัก (ปกติไม่ต้องแก้) ─────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || ''
    const cors = buildCors(origin)

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST')    return json({ error: 'ใช้ได้เฉพาะ POST' }, 405, cors)
    if (!cors['Access-Control-Allow-Origin']) {
      return json({ error: 'โดเมนนี้ไม่ได้รับอนุญาต' }, 403, cors)
    }

    // 1) ตรวจโทเคนประจำตัวผู้เรียน
    const token = request.headers.get('X-Student-Token') || ''
    if (!token) return json({ error: 'ไม่พบโทเคนประจำตัว (X-Student-Token)' }, 401, cors)

    const student = await env.PROXY.get(`token:${token}`)
    if (!student) return json({ error: 'โทเคนไม่ถูกต้องหรือถูกยกเลิกแล้ว' }, 401, cors)

    // 2) นับโควตารายวัน
    const today = new Date().toISOString().slice(0, 10)
    const usageKey = `usage:${token}:${today}`
    const used = parseInt(await env.PROXY.get(usageKey) || '0', 10)
    if (used >= DAILY_LIMIT) {
      return json({
        error: `ใช้ครบโควตาวันนี้แล้ว (${DAILY_LIMIT} ครั้ง) พรุ่งนี้เริ่มนับใหม่`,
        quotaUsed: used, quotaLimit: DAILY_LIMIT,
      }, 429, cors)
    }

    // 3) อ่านคำสั่งจากเว็บของผู้เรียน
    let body
    try { body = await request.json() } catch { return json({ error: 'รูปแบบข้อมูลไม่ถูกต้อง' }, 400, cors) }

    const system = String(body.system || 'คุณเป็นผู้ช่วยที่ตอบสั้น กระชับ เป็นภาษาไทย')
    const prompt = String(body.prompt || '')
    if (!prompt)                       return json({ error: 'ไม่พบข้อความที่จะส่งให้ AI (prompt)' }, 400, cors)
    if (prompt.length > MAX_INPUT_CHARS) return json({ error: `ข้อความยาวเกิน ${MAX_INPUT_CHARS} ตัวอักษร` }, 400, cors)

    // 4) เรียก OpenRouter — ลองโมเดลหลักก่อน ถ้าไม่ได้ใช้ตัวสำรอง
    let result = await callOpenRouter(env.OPENROUTER_KEY, PRIMARY_MODEL, system, prompt)
    let usedModel = PRIMARY_MODEL

    if (!result.ok) {
      result = await callOpenRouter(env.OPENROUTER_KEY, FALLBACK_MODEL, system, prompt)
      usedModel = FALLBACK_MODEL
    }

    // 5) ถ้าล่มทั้งคู่ → โหมดสาธิต เพื่อให้ผู้เรียนทำ Lab ต่อได้
    if (!result.ok) {
      return json({
        content: DEMO_REPLY,
        demoMode: true,
        note: 'AI เรียกไม่สำเร็จ นี่คือคำตอบจำลองเพื่อให้ทำงานต่อได้ — ห้ามใช้เป็นผลจริง',
      }, 200, cors)
    }

    // 6) บันทึกโควตาแล้วส่งคำตอบกลับ
    await env.PROXY.put(usageKey, String(used + 1), { expirationTtl: 60 * 60 * 48 })

    return json({
      content: result.content,
      model: usedModel,
      quotaUsed: used + 1,
      quotaLimit: DAILY_LIMIT,
    }, 200, cors)
  },
}

async function callOpenRouter(apiKey, model, system, prompt) {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: MAX_OUTPUT_TOKENS,
        messages: [
          { role: 'system', content: system },
          { role: 'user',   content: prompt },
        ],
      }),
    })

    if (!res.ok) return { ok: false }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content
    return content ? { ok: true, content } : { ok: false }
  } catch {
    return { ok: false }
  }
}

function buildCors(origin) {
  const allowed = ALLOWED_ORIGINS.some((re) => re.test(origin))
  return {
    'Access-Control-Allow-Origin': allowed ? origin : '',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Student-Token',
    'Access-Control-Max-Age': '86400',
  }
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors },
  })
}
