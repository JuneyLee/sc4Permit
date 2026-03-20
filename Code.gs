// ─────────────────────────────────────────────
//  작업허가서 Gemini 분석 프록시
//  배포: 웹 앱 / 실행: 나 / 액세스: 모든 사용자
// ─────────────────────────────────────────────

const GEMINI_KEY = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');

function doPost(e) {
  // CORS preflight 대응
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  try {
    const body   = JSON.parse(e.postData.contents);
    const base64 = body.image;
    const mime   = body.mime || 'image/jpeg';

    if (!base64) {
      return makeResponse({ error: '이미지 데이터가 없습니다' }, headers);
    }

    const prompt = `작업허가서를 촬영한 사진입니다.
유효한 JSON 객체만 출력하세요. JSON 외 텍스트 없이.
작업명이 두 줄에 걸쳐 있을 수 있으니 이어서 인식하세요.
작업인원은 숫자만 추출하세요 (예: "3명" → "3").
값을 읽을 수 없으면 null.
{"허가번호":"","오더번호":"","작업명":"","작업일":"","작업인원":""}`;

    const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_KEY;

    const resp = UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [
          { text: prompt },
          { inline_data: { mime_type: mime, data: base64 } }
        ]}]
      }),
      muteHttpExceptions: true
    });

    const geminiData = JSON.parse(resp.getContentText());

    if (geminiData.error) {
      return makeResponse({ error: geminiData.error.message || 'Gemini 오류' }, headers);
    }

    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(text);

    return makeResponse(result, headers);

  } catch (err) {
    return makeResponse({ error: err.message }, headers);
  }
}

function doGet(e) {
  return makeResponse({ status: 'ok', message: '작업허가서 분석 프록시 정상 동작 중' }, {
    'Content-Type': 'application/json'
  });
}

function makeResponse(obj, headers) {
  const output = ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
