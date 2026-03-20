/**
 * 웹 앱 접속 시 실행되는 기본 함수
 * @param {Object} e - 이벤트 객체
 * @return {HtmlOutput} - 브라우저에 표시될 HTML 결과물
 */
function doGet(e) {
  // HTML 파일을 생성합니다. ('Index'는 사용자가 만든 .html 파일 이름)
  const htmlOutput = HtmlService.createTemplateFromFile('Index').evaluate();
  
  // 모바일 기기에서 화면 비율을 유지하기 위한 메타 태그 설정
  htmlOutput.addMetaTag('viewport', 'width=device-width, initial-scale=1');
  
  // 제목 설정
  htmlOutput.setTitle('시스템 관리');
  
  /**
   * [중요] iframe 삽입 허용 설정
   * 이 설정이 없으면 외부 사이트의 iframe에서 구글 앱 스크립트를 불러올 수 없습니다.
   */
  htmlOutput.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  
  return htmlOutput;
}

/**
 * 필요한 경우 외부 라이브러리나 데이터를 가져오는 함수 예시
 */
function getData() {
  // 데이터 처리 로직
  return "Hello from GAS!";
}
