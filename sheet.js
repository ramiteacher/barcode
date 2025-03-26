let email = localStorage.getItem("userEmail") || "";

function decodeJWT(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');
  return JSON.parse(atob(padded));
}

function handleCredentialResponse(response) {
  const payload = decodeJWT(response.credential);
  email = payload.email;
  localStorage.setItem("userEmail", email);
  sessionStorage.setItem("userEmail", email); // PWA에서도 사용하기 위해 세션 스토리지에도 저장
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("sheetSetup").style.display = "block";
  document.getElementById("userInfo").innerText = `${email}님 환영합니다!`;
  
  // 로그인 후 바로 모든 권한 요청 (시트 읽기/쓰기)
  requestFullPermissions();
}

// 모든 필요한 권한을 로그인 시점에 한번에 요청하는 함수
async function requestFullPermissions() {
  try {
    // 이미 토큰이 있다면 검증
    if (localStorage.getItem("accessToken")) {
      try {
        // 토큰 유효성 간단 테스트
        const testRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId", {
          headers: { Authorization: "Bearer " + localStorage.getItem("accessToken") }
        });
        
        if (testRes.ok) {
          console.log("✅ 기존 토큰이 유효합니다.");
          
          // 세션 스토리지에도 토큰 저장 (PWA 지원)
          sessionStorage.setItem("accessToken", localStorage.getItem("accessToken"));
          
          // 만료 시간 설정 (1시간)
          const expiryTime = Date.now() + 3600000;
          localStorage.setItem("tokenExpiry", expiryTime.toString());
          sessionStorage.setItem("tokenExpiry", expiryTime.toString());
          
          return; // 기존 토큰이 유효하므로 종료
        }
        
        // 유효하지 않으면 제거하고 계속 진행
        localStorage.removeItem("accessToken");
        sessionStorage.removeItem("accessToken");
      } catch (e) {
        localStorage.removeItem("accessToken");
        sessionStorage.removeItem("accessToken");
        console.warn("⚠️ 저장된 토큰 검증 실패, 새로운 권한을 요청합니다:", e);
      }
    } else {
      // 세션 스토리지 확인 (PWA에서 새로고침한 경우)
      const sessionToken = sessionStorage.getItem("accessToken");
      if (sessionToken) {
        try {
          const testRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets?fields=spreadsheetId", {
            headers: { Authorization: "Bearer " + sessionToken }
          });
          
          if (testRes.ok) {
            console.log("✅ 세션 토큰이 유효합니다.");
            localStorage.setItem("accessToken", sessionToken);
            
            // 만료 시간 갱신
            const expiryTime = Date.now() + 3600000;
            localStorage.setItem("tokenExpiry", expiryTime.toString());
            sessionStorage.setItem("tokenExpiry", expiryTime.toString());
            
            return;
          }
          
          sessionStorage.removeItem("accessToken");
        } catch (e) {
          sessionStorage.removeItem("accessToken");
          console.warn("⚠️ 세션 토큰 검증 실패:", e);
        }
      }
    }
    
    // 시트 읽기/쓰기 권한을 모두 한번에 요청
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: "192783618509-d0ev6sp714cr4d43cfumfaum005g485t.apps.googleusercontent.com",
      scope: "https://www.googleapis.com/auth/spreadsheets",
      callback: (res) => {
        if (res && res.access_token) {
          // 로컬 스토리지와 세션 스토리지 모두에 토큰 저장
          localStorage.setItem("accessToken", res.access_token);
          sessionStorage.setItem("accessToken", res.access_token);
          
          // 만료 시간 설정 (1시간)
          const expiryTime = Date.now() + 3600000;
          localStorage.setItem("tokenExpiry", expiryTime.toString());
          sessionStorage.setItem("tokenExpiry", expiryTime.toString());
          
          console.log("✅ 모든 권한이 성공적으로 부여되었습니다.");
          
          // 선택적: UI 업데이트 또는 사용자에게 권한 승인 완료 알림
          const permissionIndicator = document.createElement('div');
          permissionIndicator.style.color = '#00f0ff';
          permissionIndicator.style.margin = '10px 0';
          permissionIndicator.innerHTML = '✅ Google 시트 권한이 승인되었습니다.';
          
          const setupDiv = document.getElementById('sheetSetup');
          if (setupDiv) {
            setupDiv.insertBefore(permissionIndicator, setupDiv.firstChild);
            
            // 3초 후 알림 제거
            setTimeout(() => {
              if (permissionIndicator.parentNode) {
                permissionIndicator.parentNode.removeChild(permissionIndicator);
              }
            }, 3000);
          }
        } else {
          console.error("⚠️ 권한 부여 중 오류가 발생했습니다.");
        }
      },
      error_callback: (err) => {
        console.error("⚠️ 권한 요청 실패:", err);
      }
    });
    
    // 권한 동의 화면 표시하도록 prompt 매개변수를 사용
    tokenClient.requestAccessToken({ prompt: "consent" });
  } catch (e) {
    console.error("권한 요청 중 오류:", e);
  }
}

async function createSheet() {
  const sheetName = document.getElementById("sheetName").value.trim();
  if (!sheetName) return alert("시트 이름을 입력하세요");

  let accessToken = localStorage.getItem("accessToken");
  
  // 토큰이 없으면 새로 요청
  if (!accessToken) {
    accessToken = await new Promise((resolve) => {
      google.accounts.oauth2.initTokenClient({
        client_id: "192783618509-d0ev6sp714cr4d43cfumfaum005g485t.apps.googleusercontent.com",
        scope: "https://www.googleapis.com/auth/spreadsheets",
        callback: (res) => resolve(res.access_token),
      }).requestAccessToken();
    });
    localStorage.setItem("accessToken", accessToken);
  }

  const res = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      properties: { title: sheetName },
      sheets: [
        { properties: { title: "상품재고" } },
        { properties: { title: "입출고기록" } }
      ]
    }),
  });

  const result = await res.json();
  const sheetId = result.spreadsheetId;

  await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values:batchUpdate`, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      data: [
        {
          range: "상품재고!A1:D1",
          values: [["상품코드", "상품명", "재고수량", "하자수량"]],
        },
        {
          range: "입출고기록!A1:F1",
          values: [["타임스탬프", "상품코드", "상품명", "수량", "담당자", "유형"]],
        }
      ],
      valueInputOption: "USER_ENTERED"
    }),
  });

  alert("✅ 시트가 생성되었습니다!");
  localStorage.setItem('sheetId', sheetId);
  window.location.href = `qr.html?sheetId=${sheetId}`;
}

// 중복된 이벤트 리스너 제거 및 단일 리스너로 통합
document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("createBtn");
  if (btn) {
    btn.addEventListener("click", createSheet);
  }
});