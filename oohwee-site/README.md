# 우위 (OOHWEE) 홈페이지

정적 웹사이트 + 관리자 로그인(Decap CMS)이 붙어 있는 구조예요.
사무실에서 아래 순서 그대로만 따라 하면 로그인해서 행사 상태를 클릭 몇 번으로 바꿀 수 있게 됩니다.

```
oohwee-site/
├── index.html / reference.html / apply.html   ← 3개 페이지
├── admin/                                       ← 관리자 로그인 화면 (/admin)
│   ├── index.html
│   └── config.yml
├── css/style.css
├── js/main.js            데이터를 fetch로 읽어와 화면에 그림
├── data/
│   ├── events.json        행사 목록 (관리자 화면에서 수정됨)
│   └── reference.json      레퍼런스 사진 목록 (관리자 화면에서 수정됨)
└── images/
```

---

## 0. 전체 순서 요약

1. GitHub에 이 폴더를 저장소로 올린다
2. Netlify에 그 저장소를 연결해서 배포한다
3. Netlify에서 **Identity**와 **Git Gateway**를 켠다
4. 본인을 관리자로 초대해서 비밀번호를 설정한다
5. `oohwee.xyz/admin` 으로 로그인 → 이제부터 클릭으로 행사 상태 변경 가능
6. 가비아 DNS를 Netlify에 연결한다

아래에 하나씩 자세히 적어뒀어요.

## 1. GitHub에 올리기

Decap CMS는 "로그인한 사람이 화면에서 수정 → 그 내용을 GitHub 저장소에 자동으로 커밋"하는 방식으로 동작해요. 그래서 이 폴더가 **GitHub 저장소**여야 해요.

1. https://github.com 가입 (아직 없다면)
2. 새 저장소(Repository) 생성 — 이름 예: `oohwee-site`, Public 또는 Private 아무거나 가능
3. 이 폴더(`oohwee-site`) 안의 파일들을 그 저장소에 업로드
   - GitHub 웹사이트에서 "Add file → Upload files"로 폴더 내용을 드래그해도 되고
   - Git을 쓸 줄 아는 팀원이 있다면 `git init` → `git add .` → `git commit` → `git push`로 올려도 됩니다

## 2. Netlify에 배포하기

1. https://netlify.com 가입 (GitHub 계정으로 가입하면 다음 단계가 더 쉬워요)
2. "Add new site" → **"Import an existing project"** 선택 (이전처럼 수동 업로드가 아니라, 이번엔 GitHub 연동으로 진행)
3. GitHub 계정 연결 → 방금 만든 `oohwee-site` 저장소 선택
4. 빌드 설정은 그대로 두고 "Deploy" 클릭 (별도 빌드 명령 필요 없음, 정적 파일이라 바로 배포됨)
5. 배포되면 `xxxx.netlify.app` 임시 주소가 생깁니다

## 3. Identity + Git Gateway 켜기 (관리자 로그인의 핵심)

1. Netlify 사이트 대시보드 → 상단 메뉴 **"Identity"** 탭 → "Enable Identity" 클릭
2. Identity 설정 화면에서 아래 두 가지를 확인:
   - **Registration**: "Invite only"로 설정 (아무나 가입 못 하게, 초대받은 사람만)
   - **Services → Git Gateway**: "Enable Git Gateway" 클릭
3. 다시 "Identity" 탭 → **"Invite users"** 버튼 → 본인(그리고 필요하면 팀원) 이메일 입력해서 초대
4. 초대 이메일이 오면 링크 클릭 → 비밀번호 설정

## 4. 관리자 페이지 로그인

1. 배포된 주소 + `/admin` 으로 접속 (예: `xxxx.netlify.app/admin` 또는 나중에 연결한 `oohwee.xyz/admin`)
2. "Login with Netlify Identity" 클릭 → 3번에서 설정한 이메일/비밀번호로 로그인
3. 로그인되면 왼쪽에 **"행사 공고"**, **"레퍼런스 사진"** 두 메뉴가 보여요

### 행사 상태 바꾸기 (모집중 ↔ 모집완료)
1. "행사 공고" 클릭 → "행사 목록" 클릭
2. 목록에서 행사를 펼치고 **"모집 상태"** 드롭다운에서 모집중 / 모집예정 / 마감 중 선택
3. 오른쪽 위 **"Publish"** 버튼 클릭 → 몇십 초 안에 실제 사이트에 반영됩니다

### 새 행사 올리기
1. "행사 공고" → "행사 목록" → 리스트 맨 아래 **"Add 행사 목록"** 클릭
2. 행사명, 날짜, 장소, 구좌비, 모집 상태 등을 입력
3. "Publish" 클릭

### 레퍼런스 사진 올리기
1. "레퍼런스 사진" → "레퍼런스 목록" → **"Add 레퍼런스 목록"**
2. 사진 업로드, 카테고리(프리마켓/공연/기획) 선택, 설명 입력
3. "Publish" 클릭 → 레퍼런스 페이지에 바로 추가됨

**정리하면: 로그인 → 값 바꾸기 → Publish 버튼. 코드나 파일을 직접 열 필요가 전혀 없습니다.**

## 5. 셀러 신청서 이메일 연결 (필수)

`apply.html`의 신청서는 아직 어디로도 전송되지 않는 상태예요. 무료 서비스 **Formspree**를 연결해야 실제로 신청 내역을 받을 수 있어요.

1. https://formspree.io 무료 가입
2. "New Form" 생성 → 신청받을 이메일 주소 입력
3. 발급된 주소(`https://formspree.io/f/abcdwxyz`)를 복사
4. `apply.html`에서 아래 줄을 찾아 주소를 교체 (GitHub에서 직접 수정 후 커밋하거나, 로컬에서 고쳐서 재업로드)

```html
<form class="apply-form" id="apply-form" action="https://formspree.io/f/YOUR_FORM_ID" method="POST">
```

연결 후에는:
- 신청서가 제출될 때마다 **등록한 이메일로 알림**이 오고
- **formspree.io 로그인**하면 지금까지 들어온 신청 내역을 목록·엑셀로도 볼 수 있어요 (이것도 일종의 "로그인해서 확인하는 관리자 화면"이에요, 무료 플랜은 월 50건까지)

신청서에는 개인정보 수집·이용 동의, 필수 숙지사항, 광고성 정보 수신 동의, 입점 및 운영 약관 동의까지 4개 동의 항목이 모두 필수 체크박스로 들어가 있어서, 동의하지 않으면 제출 자체가 안 됩니다.

## 6. oohwee.xyz 도메인 연결하기

1. Netlify 사이트의 **Domain management** → "Add a domain" → `oohwee.xyz` 입력
2. Netlify가 안내하는 네임서버 값을 확인
3. 가비아 로그인 → My도메인 → oohwee.xyz 관리 → DNS 정보(네임서버) 설정에서 Netlify가 준 값으로 교체
4. 전파까지 최대 반나절 정도 걸릴 수 있어요 (dnschecker.org에서 확인 가능)
5. 연결되면 Netlify가 무료 SSL(HTTPS)도 자동으로 붙여줘요

---

## 참고: 관리자 로그인 없이 지금 당장 바꾸고 싶다면

`data/events.json` 파일을 열어 `"status"` 값만 `"모집중"` / `"모집예정"` / `"마감"` 중 하나로 바꾸고 저장 → GitHub에 그대로 다시 올리면 (또는 Netlify에 재배포하면) 똑같이 반영돼요. 관리자 로그인은 이 작업을 코드 없이 화면 클릭만으로 할 수 있게 해주는 것뿐이라, 둘 중 편한 쪽으로 쓰시면 됩니다.

## 참고: 로컬에서 파일을 더블클릭해서 열면 행사 목록이 안 보여요

`index.html`을 그냥 더블클릭해서 브라우저로 열면(`file://...` 주소) 행사 목록과 레퍼런스 사진이 비어 보일 수 있어요. `data/events.json`을 불러오는 방식(fetch)이 브라우저 보안 정책상 로컬 파일에서는 막혀 있기 때문이에요. **Netlify에 배포된 주소(`https://...`)로 접속하면 정상적으로 다 보입니다** — 로컬 더블클릭은 레이아웃만 대충 확인하는 용도로 생각해 주세요.
