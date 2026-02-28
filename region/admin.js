// ===== Supabase 초기화 (Vercel 환경변수 주입) =====
// vercel.json 또는 환경변수로 아래 값이 주입됩니다
const SUPABASE_URL = 'https://vzjqfogqymthtmbzyxkz.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_911v8puVJ_Qm-iex5F1gcg_suBEEkur';
let sb = null;
let allRequests = [];
let currentFilter = 'pending';

// ===== DOMContentLoaded =====
document.addEventListener('DOMContentLoaded', () => {
    // Supabase 클라이언트 초기화
    if (!SUPABASE_URL.includes('%%')) {
        sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        checkSession();
    } else {
        // 환경변수 미설정 → URL/Key 직접 입력 폼 표시
        showManualInput();
    }
    setupDragDrop();
    document.getElementById('fileInput').addEventListener('change', handleFile);
});

// 환경변수 미설정 시 로그인 폼에 입력 필드 추가
function showManualInput() {
    const loginBox = document.querySelector('.login-box');
    const extraHtml = `
        <div style="margin-bottom:20px; padding:14px; background:#f0fffe; border-radius:10px; border:1px solid #b2ebf2;">
            <p style="font-size:0.78rem; color:#0984e3; margin-bottom:10px;"><i class="fas fa-info-circle"></i> Vercel 환경변수가 설정되지 않았습니다. 아래에 직접 입력하세요.</p>
            <div style="margin-bottom:8px;">
                <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:4px;">Supabase Project URL</label>
                <input type="text" id="manualUrl" placeholder="https://xxxx.supabase.co" style="width:100%; padding:8px 12px; border:1.5px solid #b2ebf2; border-radius:8px; font-size:0.82rem;">
            </div>
            <div>
                <label style="font-size:0.78rem; font-weight:600; display:block; margin-bottom:4px;">Supabase Anon Key</label>
                <input type="password" id="manualKey" placeholder="eyJ..." style="width:100%; padding:8px 12px; border:1.5px solid #b2ebf2; border-radius:8px; font-size:0.82rem;">
            </div>
        </div>
    `;
    loginBox.querySelector('.login-logo').insertAdjacentHTML('afterend', extraHtml);
}

// ===== 세션 확인 =====
async function checkSession() {
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    if (session) {
        showAdmin(session.user.email);
    }
}

// ===== 로그인 =====
async function doLogin() {
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    const btn = document.getElementById('loginBtn');

    if (!email || !password) {
        errorEl.textContent = '이메일과 비밀번호를 입력해주세요.';
        errorEl.style.display = 'block';
        return;
    }

    // 환경변수 미설정 시 sb 재초기화
    if (!sb || SUPABASE_URL.includes('%%')) {
        const url = document.getElementById('manualUrl')?.value.trim();
        const key = document.getElementById('manualKey')?.value.trim();
        if (!url || !key) {
            errorEl.textContent = 'Supabase URL과 Key를 입력해주세요.';
            errorEl.style.display = 'block';
            return;
        }
        sb = supabase.createClient(url, key);
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 로그인 중...';
    errorEl.style.display = 'none';

    const { data, error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
        errorEl.textContent = '로그인 실패: 이메일 또는 비밀번호를 확인해주세요.';
        errorEl.style.display = 'block';
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> 로그인';
        return;
    }

    showAdmin(data.user.email);
}

// ===== 관리자 화면 표시 =====
async function showAdmin(email) {
    document.getElementById('loginWrap').style.display = 'none';
    document.getElementById('adminWrap').style.display = 'block';
    document.getElementById('headerUser').textContent = email;
    await loadRequests();
    await loadStoreRequests();
    loadStats();
}

// ===== 로그아웃 =====
async function doLogout() {
    if (!sb) return;
    await sb.auth.signOut();
    location.reload();
}

// ===== 탭 전환 =====
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => { c.classList.remove('active'); c.style.display = 'none'; });
    if (tab === 'requests') {
        document.getElementById('tabRequests').classList.add('active');
        document.getElementById('tabContentRequests').style.display = 'block';
        document.getElementById('tabContentRequests').classList.add('active');
    } else if (tab === 'storeManage') {
        document.getElementById('tabStoreManage').classList.add('active');
        document.getElementById('tabContentStoreManage').style.display = 'block';
        document.getElementById('tabContentStoreManage').classList.add('active');
        if (allStores.length === 0) loadStoreManage();
    } else if (tab === 'storeRequests') {
        document.getElementById('tabStoreRequests').classList.add('active');
        document.getElementById('tabContentStoreRequests').style.display = 'block';
        document.getElementById('tabContentStoreRequests').classList.add('active');
    } else {
        document.getElementById('tabUpload').classList.add('active');
        document.getElementById('tabContentUpload').style.display = 'block';
        document.getElementById('tabContentUpload').classList.add('active');
    }
}

// ===== 가게등록 요청 =====
let allStoreRequests = [];
let currentStoreFilter = 'pending';

async function loadStoreRequests() {
    if (!sb) return;
    const { data, error } = await sb.from('store_requests').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    allStoreRequests = data || [];
    const pendingCount = allStoreRequests.filter(r => r.status === 'pending').length;
    document.getElementById('storePendingBadge').textContent = pendingCount;
    renderStoreRequests();
}

function filterStoreRequests(status) {
    currentStoreFilter = status;
    document.querySelectorAll('#tabContentStoreRequests .filter-tab').forEach(t => t.classList.remove('active'));
    const map = { pending: 'sftPending', approved: 'sftApproved', rejected: 'sftRejected', all: 'sftAll' };
    document.getElementById(map[status]).classList.add('active');
    renderStoreRequests();
}

function renderStoreRequests() {
    const list = document.getElementById('storeRequestList');
    const filtered = currentStoreFilter === 'all' ? allStoreRequests : allStoreRequests.filter(r => r.status === currentStoreFilter);

    if (filtered.length === 0) {
        const msgs = { pending: '대기 중인 등록요청이 없습니다.', approved: '승인된 요청이 없습니다.', rejected: '거절된 요청이 없습니다.', all: '등록요청이 없습니다.' };
        list.innerHTML = `<div class="empty-state"><i class="fas fa-store"></i><p>${msgs[currentStoreFilter]}</p></div>`;
        return;
    }

    list.innerHTML = filtered.map(req => {
        const date = new Date(req.created_at).toLocaleString('ko-KR');
        const statusBadge = {
            pending: '<span class="status-badge status-pending">⏳ 대기중</span>',
            approved: '<span class="status-badge status-approved">✅ 승인됨</span>',
            rejected: '<span class="status-badge status-rejected">❌ 거절됨</span>',
        }[req.status] || '';

        const facilities = [
            req.has_parking ? '주차' : null,
            req.has_nursing_room ? '수유실' : null,
            req.has_highchair ? '유아의자' : null,
            req.has_stroller_access ? '유모차' : null,
        ].filter(Boolean).join(', ') || '-';

        const actions = req.status === 'pending' ? `
            <button class="btn btn-sm btn-danger" onclick="rejectStoreRequest(${req.id})"><i class="fas fa-times"></i> 거절</button>
            <button class="btn btn-sm btn-secondary" onclick="approveStoreRequest(${req.id})"><i class="fas fa-check"></i> 승인 (stores에 등록)</button>
        ` : statusBadge;

        return `
        <div class="request-card ${req.status}" id="sreq-${req.id}">
            <div class="request-header">
                <div>
                    <div class="request-store">🏪 ${escHtml(req.name)}</div>
                    <span class="request-field">${escHtml(req.category || '')} ${req.subcategory ? '· ' + escHtml(req.subcategory) : ''}</span>
                </div>
                <div class="request-date">${date}</div>
            </div>
            <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:8px; margin-bottom:10px; font-size:0.82rem;">
                <div><b>지역</b> ${escHtml(req.region || '-')} ${req.district ? escHtml(req.district) : ''}</div>
                <div><b>주소</b> ${escHtml(req.address || '-')}</div>
                <div><b>전화</b> ${escHtml(req.phone || '-')}</div>
                <div><b>영업시간</b> ${escHtml(req.hours || '-')}</div>
                <div><b>키즈시설</b> ${escHtml(req.playroom_type || '-')} ${req.playroom_desc ? '· ' + escHtml(req.playroom_desc) : ''}</div>
                <div><b>편의시설</b> ${facilities}</div>
                <div><b>연령</b> ${escHtml(req.age_range || '-')}</div>
                <div><b>가격대</b> ${escHtml(req.price_range || '-')}</div>
                ${req.tags ? `<div><b>태그</b> ${escHtml(req.tags.join(', '))}</div>` : ''}
                ${req.description ? `<div style="grid-column:1/-1"><b>소개</b> ${escHtml(req.description)}</div>` : ''}
            </div>
            <div class="request-actions">${actions}</div>
        </div>`;
    }).join('');
}

async function approveStoreRequest(id) {
    if (!sb) return;
    const req = allStoreRequests.find(r => r.id === id);
    if (!req) return;
    if (!confirm(`"${req.name}"을 stores 테이블에 등록하시겠습니까?`)) return;

    try {
        // stores 테이블에 insert
        const { status, created_at, id: reqId, ...storeData } = req;
        const { error: insertErr } = await sb.from('stores').insert(storeData);
        if (insertErr) throw insertErr;

        // store_requests status → approved
        const { error: statusErr } = await sb.from('store_requests').update({ status: 'approved' }).eq('id', id);
        if (statusErr) throw statusErr;

        allStoreRequests = allStoreRequests.map(r => r.id === id ? {...r, status: 'approved'} : r);
        document.getElementById('storePendingBadge').textContent = allStoreRequests.filter(r => r.status === 'pending').length;
        renderStoreRequests();
        showToast(`✅ "${req.name}" stores에 등록 완료!`);
    } catch(e) {
        alert('오류: ' + e.message);
    }
}

async function rejectStoreRequest(id) {
    if (!sb) return;
    if (!confirm('이 요청을 거절하시겠습니까?')) return;
    try {
        const { error } = await sb.from('store_requests').update({ status: 'rejected' }).eq('id', id);
        if (error) throw error;
        allStoreRequests = allStoreRequests.map(r => r.id === id ? {...r, status: 'rejected'} : r);
        document.getElementById('storePendingBadge').textContent = allStoreRequests.filter(r => r.status === 'pending').length;
        renderStoreRequests();
        showToast('❌ 거절 처리되었습니다.');
    } catch(e) { alert('오류: ' + e.message); }
}

// ===== 수정요청 로드 =====
async function loadRequests() {
    if (!sb) return;
    const { data, error } = await sb.from('edit_requests').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return; }
    allRequests = data || [];
    const pendingCount = allRequests.filter(r => r.status === 'pending').length;
    document.getElementById('pendingBadge').textContent = pendingCount;
    renderRequests();
}

// ===== 필터 =====
function filterRequests(status) {
    currentFilter = status;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    const map = { pending: 'ftPending', approved: 'ftApproved', rejected: 'ftRejected', all: 'ftAll' };
    document.getElementById(map[status]).classList.add('active');
    renderRequests();
}

// ===== 수정 항목별 설정 =====
const FIELD_MAP = {
    '영업시간': 'hours',
    '전화번호': 'phone',
    '주소': 'address',
    '키즈존정보': 'playroom_desc',
};
const MANUAL_FIELDS = ['편의시설', '폐업', '기타'];

// ===== 수정요청 렌더링 =====
function renderRequests() {
    const list = document.getElementById('requestList');
    const filtered = currentFilter === 'all' ? allRequests : allRequests.filter(r => r.status === currentFilter);

    if (filtered.length === 0) {
        const msgs = { pending: '대기 중인 수정요청이 없습니다.', approved: '승인된 요청이 없습니다.', rejected: '거절된 요청이 없습니다.', all: '수정요청이 없습니다.' };
        list.innerHTML = `<div class="empty-state"><i class="fas fa-inbox"></i><p>${msgs[currentFilter]}</p></div>`;
        return;
    }

    list.innerHTML = filtered.map(req => {
        const date = new Date(req.created_at).toLocaleString('ko-KR');
        const isManual = MANUAL_FIELDS.includes(req.field_name);
        const statusBadge = {
            pending: '<span class="status-badge status-pending">⏳ 대기중</span>',
            approved: '<span class="status-badge status-approved">✅ 승인됨</span>',
            rejected: '<span class="status-badge status-rejected">❌ 거절됨</span>',
        }[req.status] || '';

        let actions = statusBadge;
        if (req.status === 'pending') {
            if (isManual) {
                actions = `
                    <button class="btn btn-sm btn-danger" onclick="rejectRequest(${req.id})"><i class="fas fa-times"></i> 거절</button>
                    <button class="btn btn-sm btn-purple" onclick="toggleManualEdit(${req.id})"><i class="fas fa-pen"></i> 직접 수정</button>
                `;
            } else {
                actions = `
                    <button class="btn btn-sm btn-danger" onclick="rejectRequest(${req.id})"><i class="fas fa-times"></i> 거절</button>
                    <button class="btn btn-sm btn-secondary" onclick="approveRequest(${req.id}, '${escStr(req.store_name)}', '${escStr(req.field_name)}', '${escStr(req.new_value)}')"><i class="fas fa-check"></i> 승인</button>
                `;
            }
        }

        // 편의시설 직접 편집 폼
        const manualForm = isManual && req.status === 'pending' ? `
        <div class="manual-edit-form" id="manualForm-${req.id}">
            <label>🔧 "${escHtml(req.store_name)}" 가게 정보를 직접 수정하세요</label>
            <div style="font-size:0.78rem; color:#6c5ce7; margin-bottom:10px;">
                사용자 요청 내용: <b>${escHtml(req.new_value)}</b>
                ${req.reason ? ` / 사유: ${escHtml(req.reason)}` : ''}
            </div>
            <div class="manual-edit-grid">
                <div class="edit-field"><label>주차 가능</label><select id="ef-parking-${req.id}"><option value="">변경 안 함</option><option value="true">있음</option><option value="false">없음</option></select></div>
                <div class="edit-field"><label>수유실</label><select id="ef-nursing-${req.id}"><option value="">변경 안 함</option><option value="true">있음</option><option value="false">없음</option></select></div>
                <div class="edit-field"><label>유아의자</label><select id="ef-highchair-${req.id}"><option value="">변경 안 함</option><option value="true">있음</option><option value="false">없음</option></select></div>
                <div class="edit-field"><label>유모차 접근</label><select id="ef-stroller-${req.id}"><option value="">변경 안 함</option><option value="true">있음</option><option value="false">없음</option></select></div>
                ${req.field_name === '폐업' ? `<div class="edit-field"><label>가게 상태 (폐업 시 이름에 [폐업] 추가)</label><input type="text" id="ef-name-${req.id}" placeholder="예: 맛있는고기집 [폐업]"></div>` : ''}
            </div>
            <div style="display:flex; gap:8px; justify-content:flex-end;">
                <button class="btn btn-sm btn-outline" onclick="toggleManualEdit(${req.id})">취소</button>
                <button class="manual-save-btn" onclick="saveManualEdit(${req.id}, '${escStr(req.store_name)}')"><i class="fas fa-save"></i> 저장 및 승인</button>
            </div>
        </div>` : '';

        return `
        <div class="request-card ${req.status}${isManual && req.status==='pending' ? ' manual' : ''}" id="req-${req.id}">
            <div class="request-header">
                <div>
                    <div class="request-store">🏪 ${escHtml(req.store_name)}</div>
                    <span class="request-field ${isManual ? 'manual-tag' : ''}">${escHtml(req.field_name)}</span>
                </div>
                <div class="request-date">${date}</div>
            </div>
            <div class="request-values">
                <div class="val-box val-old">${escHtml(req.old_value || '(없음)')}</div>
                <div class="val-arrow">→</div>
                <div class="val-box val-new">${escHtml(req.new_value)}</div>
            </div>
            ${req.reason ? `<div class="request-reason">💬 사유: ${escHtml(req.reason)}</div>` : ''}
            <div class="request-actions">${actions}</div>
            ${manualForm}
        </div>`;
    }).join('');
}

function escHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function escStr(str) {
    if (!str) return '';
    return String(str).replace(/'/g,"\\'").replace(/"/g,'\\"');
}

// ===== 직접 수정 폼 토글 =====
function toggleManualEdit(id) {
    const form = document.getElementById(`manualForm-${id}`);
    if (form) form.classList.toggle('open');
}

// ===== 수동 항목 저장 =====
async function saveManualEdit(id, storeName) {
    if (!sb) return;
    try {
        const { data: stores, error: findErr } = await sb.from('stores').select('id').ilike('name', storeName).limit(1);
        if (findErr) throw findErr;
        if (!stores || stores.length === 0) {
            alert(`"${storeName}" 가게를 stores 테이블에서 찾을 수 없습니다.`);
            return;
        }
        const storeId = stores[0].id;
        const updates = {};

        const parking = document.getElementById(`ef-parking-${id}`)?.value;
        const nursing = document.getElementById(`ef-nursing-${id}`)?.value;
        const highchair = document.getElementById(`ef-highchair-${id}`)?.value;
        const stroller = document.getElementById(`ef-stroller-${id}`)?.value;
        const name = document.getElementById(`ef-name-${id}`)?.value.trim();

        if (parking !== '') updates.has_parking = parking === 'true';
        if (nursing !== '') updates.has_nursing_room = nursing === 'true';
        if (highchair !== '') updates.has_highchair = highchair === 'true';
        if (stroller !== '') updates.has_stroller_access = stroller === 'true';
        if (name) updates.name = name;

        if (Object.keys(updates).length === 0) {
            alert('변경할 항목을 선택해주세요.');
            return;
        }

        const { error: updateErr } = await sb.from('stores').update(updates).eq('id', storeId);
        if (updateErr) throw updateErr;

        const { error: statusErr } = await sb.from('edit_requests').update({ status: 'approved' }).eq('id', id);
        if (statusErr) throw statusErr;

        allRequests = allRequests.map(r => r.id === id ? {...r, status: 'approved'} : r);
        document.getElementById('pendingBadge').textContent = allRequests.filter(r => r.status === 'pending').length;
        renderRequests();
        showToast('✅ 저장 완료! stores 테이블이 업데이트되었습니다.');
    } catch(e) {
        alert('오류: ' + e.message);
    }
}

// ===== 자동 승인 =====
async function approveRequest(id, storeName, fieldName, newValue) {
    if (!sb) return;
    if (!confirm(`"${storeName}"의 ${fieldName}을 "${newValue}"로 변경할까요?`)) return;
    try {
        const { data: stores, error: findErr } = await sb.from('stores').select('id').ilike('name', storeName).limit(1);
        if (findErr) throw findErr;
        if (!stores || stores.length === 0) { alert(`"${storeName}" 가게를 찾을 수 없습니다.`); return; }

        const mappedField = FIELD_MAP[fieldName] || fieldName;
        let parsedValue = newValue;
        if (['has_parking','has_nursing_room','has_highchair','has_stroller_access'].includes(mappedField)) {
            parsedValue = ['true','1','o','O','예','Y','y','있음','가능'].includes(newValue);
        } else if (['lat','lng','rating'].includes(mappedField)) {
            parsedValue = parseFloat(newValue);
        } else if (mappedField === 'review_count') {
            parsedValue = parseInt(newValue);
        }

        const { error: updateErr } = await sb.from('stores').update({ [mappedField]: parsedValue }).eq('id', stores[0].id);
        if (updateErr) throw updateErr;

        const { error: statusErr } = await sb.from('edit_requests').update({ status: 'approved' }).eq('id', id);
        if (statusErr) throw statusErr;

        allRequests = allRequests.map(r => r.id === id ? {...r, status: 'approved'} : r);
        document.getElementById('pendingBadge').textContent = allRequests.filter(r => r.status === 'pending').length;
        renderRequests();
        showToast('✅ 승인 완료!');
    } catch(e) { alert('오류: ' + e.message); }
}

// ===== 거절 =====
async function rejectRequest(id) {
    if (!sb) return;
    if (!confirm('이 요청을 거절하시겠습니까?')) return;
    try {
        const { error } = await sb.from('edit_requests').update({ status: 'rejected' }).eq('id', id);
        if (error) throw error;
        allRequests = allRequests.map(r => r.id === id ? {...r, status: 'rejected'} : r);
        document.getElementById('pendingBadge').textContent = allRequests.filter(r => r.status === 'pending').length;
        renderRequests();
        showToast('❌ 거절 처리되었습니다.');
    } catch(e) { alert('오류: ' + e.message); }
}

// ===== 토스트 =====
function showToast(msg) {
    const t = document.createElement('div');
    t.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;background:#2d3748;color:white;padding:14px 20px;border-radius:12px;font-size:0.85rem;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.2);';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

// ===== Stats =====
async function loadStats() {
    try {
        const r = await fetch('tables/stores?limit=1');
        const res = await r.json();
        const total = res.total || 0;
        document.getElementById('statTotal').textContent = total.toLocaleString();
        if (total > 0) {
            let allData = [];
            const pages = Math.ceil(Math.min(total, 500) / 100);
            for (let p = 1; p <= pages; p++) {
                const pr = await fetch(`tables/stores?page=${p}&limit=100`);
                const pres = await pr.json();
                allData = allData.concat(pres.data || []);
            }
            document.getElementById('statCat').textContent = new Set(allData.map(d => d.category).filter(Boolean)).size;
            document.getElementById('statRegion').textContent = new Set(allData.map(d => d.region).filter(Boolean)).size;
            document.getElementById('statAvgRating').textContent = (allData.reduce((s,d) => s + (d.rating||0), 0) / allData.length).toFixed(1);
        }
    } catch(e) { console.error(e); }
}

// ===== CSV 업로드 =====
let csvData = null;
let mapping = {};

const DB_FIELDS = [
    { key: 'name', label: '가게 이름', required: true },
    { key: 'category', label: '업종(대분류)', required: false, hint: '식당/카페/키즈카페/뷔페/베이커리' },
    { key: 'subcategory', label: '세부업종', required: false },
    { key: 'region', label: '지역(시/도)', required: false },
    { key: 'district', label: '구/군', required: false },
    { key: 'address', label: '상세주소', required: false },
    { key: 'lat', label: '위도', required: false },
    { key: 'lng', label: '경도', required: false },
    { key: 'phone', label: '전화번호', required: false },
    { key: 'hours', label: '영업시간', required: false },
    { key: 'playroom_type', label: '놀이방 유형', required: false },
    { key: 'playroom_desc', label: '놀이방 설명', required: false },
    { key: 'age_range', label: '권장 연령', required: false },
    { key: 'has_parking', label: '주차 여부', required: false },
    { key: 'has_nursing_room', label: '수유실 여부', required: false },
    { key: 'has_highchair', label: '유아의자 여부', required: false },
    { key: 'has_stroller_access', label: '유모차 접근', required: false },
    { key: 'price_range', label: '가격대', required: false },
    { key: 'rating', label: '평점', required: false },
    { key: 'review_count', label: '리뷰 수', required: false },
    { key: 'tags', label: '태그', required: false },
    { key: 'description', label: '가게 소개', required: false },
];

function setupDragDrop() {
    const zone = document.getElementById('uploadZone');
    if (!zone) return;
    ['dragenter','dragover'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.add('dragover'); }));
    ['dragleave','drop'].forEach(e => zone.addEventListener(e, ev => { ev.preventDefault(); zone.classList.remove('dragover'); }));
    zone.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (f) parseFile(f); });
}

function handleFile(e) { const f = e.target.files[0]; if (f) parseFile(f); }

function parseFile(file) {
    Papa.parse(file, {
        header: true, skipEmptyLines: true,
        complete: r => { csvData = { headers: r.meta.fields, rows: r.data }; goStep(2); showPreview(); },
        error: e => alert('파일 파싱 오류: ' + e.message)
    });
}

function showPreview() {
    const h = csvData.headers;
    document.getElementById('previewHead').innerHTML = '<tr>' + h.map(c => `<th>${c}</th>`).join('') + '</tr>';
    document.getElementById('previewBody').innerHTML = csvData.rows.slice(0,20).map(r => '<tr>' + h.map(c => `<td title="${r[c]||''}">${r[c]||''}</td>`).join('') + '</tr>').join('');
    document.getElementById('previewCount').textContent = `전체 ${csvData.rows.length}행`;
    document.getElementById('previewAlert').innerHTML = `<i class="fas fa-check-circle"></i> <span>${csvData.rows.length}건 파싱 완료. 컬럼 ${h.length}개 감지.</span>`;
}

function buildMapping() {
    const grid = document.getElementById('mappingGrid');
    grid.innerHTML = DB_FIELDS.map(f => {
        const opts = ['<option value="">-- 선택 안 함 --</option>'].concat(
            csvData.headers.map(h => {
                const sel = h.toLowerCase().includes(f.key.toLowerCase()) || f.key.toLowerCase().includes(h.toLowerCase()) ? 'selected' : '';
                return `<option value="${h}" ${sel}>${h}</option>`;
            })
        ).join('');
        return `<div class="mapping-item">
            <span class="field-name">${f.label}${f.required ? '<span class="field-required"> *</span>' : ''}</span>
            <i class="fas fa-arrow-right"></i>
            <select data-field="${f.key}" onchange="updateMapping(this)">${opts}</select>
        </div>`;
    }).join('');
    document.querySelectorAll('.mapping-item select').forEach(s => updateMapping(s));
}

function updateMapping(sel) {
    mapping[sel.dataset.field] = sel.value;
    sel.className = sel.value ? 'mapped' : 'unmapped';
}

function goStep(n) {
    [1,2,3,4].forEach(i => {
        const s = document.getElementById('step'+i);
        s.className = 'step' + (i < n ? ' done' : (i === n ? ' active' : ''));
    });
    document.getElementById('sectionUpload').classList.toggle('hidden', n !== 1);
    document.getElementById('sectionPreview').classList.toggle('hidden', n !== 2);
    document.getElementById('sectionMapping').classList.toggle('hidden', n !== 3);
    document.getElementById('sectionResult').classList.toggle('hidden', n !== 4);
    if (n === 3) buildMapping();
}

async function startUpload() {
    if (!csvData || csvData.rows.length === 0) { alert('업로드할 데이터가 없습니다.'); return; }
    if (!confirm(`총 ${csvData.rows.length}건을 업로드합니다. 계속하시겠습니까?`)) return;

    goStep(4);
    const log = document.getElementById('resultLog');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    log.innerHTML = '';
    function addLog(msg, type='info') { log.innerHTML += `<div class="${type}">  ${msg}</div>`; log.scrollTop = log.scrollHeight; }

    const existingAction = document.querySelector('input[name="existingData"]:checked').value;
    if (existingAction === 'clear') {
        addLog('⚠️ 기존 데이터 삭제 시작...', 'warn');
        try {
            while (true) {
                const r = await fetch('tables/stores?page=1&limit=100');
                const res = await r.json();
                const data = res.data || [];
                if (data.length === 0) break;
                await Promise.all(data.map(d => fetch(`tables/stores/${d.id}`, { method: 'DELETE' })));
                addLog(`  🗑️ ${data.length}건 삭제`, 'warn');
            }
            addLog('✅ 기존 데이터 삭제 완료', 'success');
        } catch(e) { addLog('❌ 삭제 중 오류: ' + e.message, 'error'); }
    }

    addLog(`📋 ${csvData.rows.length}건 변환 시작...`, 'info');
    const records = []; let skipCount = 0;
    csvData.rows.forEach(row => {
        const record = {};
        DB_FIELDS.forEach(field => {
            const csvCol = mapping[field.key];
            if (csvCol && row[csvCol] !== undefined && row[csvCol] !== '') {
                let val = String(row[csvCol]).trim();
                if (['lat','lng','rating'].includes(field.key)) val = parseFloat(val) || 0;
                else if (field.key === 'review_count') val = parseInt(val) || 0;
                else if (['has_parking','has_nursing_room','has_highchair','has_stroller_access'].includes(field.key)) val = ['true','1','o','O','예','Y','y','있음','가능'].includes(val);
                else if (field.key === 'tags') val = val.split(/[,;|]/).map(t => t.trim()).filter(Boolean);
                else if (field.key === 'price_range') { if (['저렴','싸다','낮음','low'].includes(val.toLowerCase())) val='$'; else if (['보통','중간','medium','mid'].includes(val.toLowerCase())) val='$$'; else if (['고급','비쌈','높음','high','프리미엄'].includes(val.toLowerCase())) val='$$$'; }
                record[field.key] = val;
            }
        });
        if (!record.name) { skipCount++; return; }
        if (!record.category) record.category = '식당';
        if (!record.subcategory) record.subcategory = '한식';
        if (!record.region) { const addr = record.address || ''; record.region = ['서울','경기','인천','부산','대구','대전','광주','울산','경남','충북','충남','강원','제주'].find(r => addr.includes(r)) || '서울'; }
        if (!record.playroom_type) record.playroom_type = '키즈존';
        if (!record.age_range) record.age_range = '전연령';
        if (!record.price_range) record.price_range = '$$';
        if (!record.rating) record.rating = +(3.5 + Math.random() * 1.5).toFixed(1);
        if (!record.review_count) record.review_count = Math.floor(10 + Math.random() * 200);
        if (!record.tags || record.tags.length === 0) record.tags = ['가족외식', '아이'];
        if (!record.description) record.description = record.playroom_desc || '키즈프렌들리 가게입니다.';
        records.push(record);
    });
    addLog(`✅ 변환 완료: ${records.length}건 (스킵: ${skipCount}건)`, 'success');

    if (records.length === 0) { addLog('❌ 업로드할 데이터가 없습니다.', 'error'); document.getElementById('resultActions').style.display = 'flex'; return; }

    addLog(`🚀 API 업로드 시작 (${records.length}건)...`, 'info');
    const batchSize = 20; let uploaded = 0; let errors = 0;
    for (let i = 0; i < records.length; i += batchSize) {
        const batch = records.slice(i, i + batchSize);
        const results = await Promise.allSettled(batch.map(rec => fetch('tables/stores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) })));
        results.forEach((r, j) => { if (r.status === 'fulfilled' && r.value.ok) uploaded++; else { errors++; addLog(`  ⚠️ [${i+j+1}] ${batch[j].name} 실패`, 'error'); } });
        const pct = Math.round(((i + batch.length) / records.length) * 100);
        progressFill.style.width = pct + '%';
        progressText.textContent = `${uploaded}/${records.length} 업로드 완료 (${pct}%)`;
    }
    progressFill.style.width = '100%';
    addLog('═══════════════════════════════════', 'info');
    addLog(`🎉 업로드 완료! ✅ 성공: ${uploaded}건${errors > 0 ? ` / ❌ 실패: ${errors}건` : ''}`, 'success');
    addLog('═══════════════════════════════════', 'info');
    progressText.textContent = `완료! ${uploaded}건 업로드 성공`;
    document.getElementById('resultActions').style.display = 'flex';
}

function downloadTemplate() {
    const headers = DB_FIELDS.map(f => f.key);
    const example = { name:'맛있는 고기집', category:'식당', subcategory:'고기집', region:'서울', district:'강남구', address:'서울 강남구 테헤란로 123', lat:'37.498', lng:'127.028', phone:'02-123-4567', hours:'11:00~22:00 (월 휴무)', playroom_type:'실내놀이방', playroom_desc:'볼풀+미끄럼틀 키즈존 운영', age_range:'전연령', has_parking:'O', has_nursing_room:'O', has_highchair:'O', has_stroller_access:'O', price_range:'$$', rating:'4.3', review_count:'150', tags:'한우,숯불구이,생일파티', description:'프리미엄 한우 전문점' };
    const csv = headers.join(',') + '\n' + headers.map(h => `"${example[h] || ''}"`).join(',') + '\n';
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'kidsgo_template.csv'; a.click();
    URL.revokeObjectURL(url);
}
// ===== 가게 관리 탭 =====
let allStores = [];
let smPage = 1;
const SM_PAGE_SIZE = 15;

async function loadStoreManage() {
    if (!sb) return;
    const { data, error } = await sb.from('stores').select('*').order('name', { ascending: true });
    if (error) { console.error(error); return; }
    allStores = data || [];
    renderStoreManage();
}

function getFilteredStores() {
    const search = (document.getElementById('smSearch')?.value || '').trim().toLowerCase();
    const filter = document.getElementById('smFilter')?.value || 'all';
    return allStores.filter(s => {
        if (search && !s.name.toLowerCase().includes(search)) return false;
        if (filter === 'missing') return !s.has_parking && !s.has_nursing_room && !s.has_highchair && !s.has_stroller_access;
        if (filter === 'no_hours') return !s.hours;
        if (filter === 'no_phone') return !s.phone;
        return true;
    });
}

function renderStoreManage() {
    const list = document.getElementById('storeManageList');
    if (!list) return;
    const filtered = getFilteredStores();
    const totalPages = Math.ceil(filtered.length / SM_PAGE_SIZE);
    if (smPage > totalPages) smPage = 1;
    const paged = filtered.slice((smPage - 1) * SM_PAGE_SIZE, smPage * SM_PAGE_SIZE);

    document.getElementById('smCount').textContent = `${filtered.length}개`;

    if (paged.length === 0) {
        list.innerHTML = '<div class="empty-state"><i class="fas fa-store"></i><p>해당하는 가게가 없습니다.</p></div>';
        document.getElementById('smPagination').innerHTML = '';
        return;
    }

    list.innerHTML = paged.map(s => {
        const isMissing = !s.has_parking && !s.has_nursing_room && !s.has_highchair && !s.has_stroller_access;
        const naverSearch = `https://map.naver.com/p/search/${encodeURIComponent(s.name + ' ' + (s.address || ''))}`;
        return `
        <div class="store-manage-card ${isMissing ? 'missing' : ''}" id="smc-${s.id}">
            <div class="sm-header">
                <div>
                    <div class="sm-name">🏪 ${escHtml(s.name)}</div>
                    <div class="sm-meta">${escHtml(s.region || '')} ${escHtml(s.district || '')} · ${escHtml(s.category || '')}</div>
                </div>
                <a href="javascript:void(0)" onclick="window.open('${naverSearch}', 'naver', 'width=860,height=720,left='+Math.round(window.screenX+window.outerWidth-880)+',top='+Math.round(window.screenY+80)+'')" rel="noopener"
                   style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;background:#03C75A;color:white;border-radius:8px;font-size:0.78rem;font-weight:600;text-decoration:none;">
                    <i class="fas fa-map-marker-alt"></i> 네이버 확인
                </a>
            </div>

            <div style="font-size:0.78rem;color:var(--text-light);margin-bottom:10px;">📍 ${escHtml(s.address || '-')}</div>

            <!-- 편의시설 체크박스 -->
            <div class="sm-facilities">
                <label class="sm-check"><input type="checkbox" id="sm-parking-${s.id}" ${s.has_parking ? 'checked' : ''}> 🅿️ 주차</label>
                <label class="sm-check"><input type="checkbox" id="sm-nursing-${s.id}" ${s.has_nursing_room ? 'checked' : ''}> 🍼 수유실</label>
                <label class="sm-check"><input type="checkbox" id="sm-highchair-${s.id}" ${s.has_highchair ? 'checked' : ''}> 🪑 유아의자</label>
                <label class="sm-check"><input type="checkbox" id="sm-stroller-${s.id}" ${s.has_stroller_access ? 'checked' : ''}> 👶 유모차</label>
            </div>

            <!-- 텍스트 필드 -->
            <div class="sm-body">
                <div class="sm-field">
                    <label>전화번호</label>
                    <input type="text" id="sm-phone-${s.id}" value="${escHtml(s.phone || '')}" placeholder="02-000-0000">
                </div>
                <div class="sm-field">
                    <label>영업시간</label>
                    <input type="text" id="sm-hours-${s.id}" value="${escHtml(s.hours || '')}" placeholder="11:00~22:00 (월 휴무)">
                </div>
                <div class="sm-field">
                    <label>놀이시설 유형</label>
                    <select id="sm-playroom-${s.id}">
                        <option value="">선택</option>
                        ${['키즈존','실내놀이방','볼풀','미끄럼틀','트램펄린','키즈카페형'].map(v => `<option value="${v}" ${s.playroom_type===v?'selected':''}>${v}</option>`).join('')}
                    </select>
                </div>
                <div class="sm-field">
                    <label>가격대</label>
                    <select id="sm-price-${s.id}">
                        ${['$','$$','$$$'].map(v => `<option value="${v}" ${s.price_range===v?'selected':''}>${v}</option>`).join('')}
                    </select>
                </div>
                <div class="sm-field">
                    <label>놀이시설 설명</label>
                    <input type="text" id="sm-playdesc-${s.id}" value="${escHtml(s.playroom_desc || '')}" placeholder="볼풀+미끄럼틀, CCTV 완비">
                </div>
                <div class="sm-field">
                    <label>연령대</label>
                    <select id="sm-age-${s.id}">
                        ${['전연령','0~3세','3~5세','5~10세','초등학생'].map(v => `<option value="${v}" ${s.age_range===v?'selected':''}>${v}</option>`).join('')}
                    </select>
                </div>
            </div>

            <div class="sm-actions">
                <button class="btn btn-sm btn-danger" onclick="deleteStore(${s.id}, '${escStr(s.name)}')">
                    <i class="fas fa-trash"></i> 삭제
                </button>
                <button class="btn btn-sm btn-secondary" onclick="saveStore(${s.id})">
                    <i class="fas fa-save"></i> 저장
                </button>
            </div>
        </div>`;
    }).join('');

    // 페이지네이션
    const pg = document.getElementById('smPagination');
    pg.innerHTML = '';
    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = 'sm-page-btn' + (i === smPage ? ' active' : '');
        btn.textContent = i;
        btn.onclick = () => { smPage = i; renderStoreManage(); };
        pg.appendChild(btn);
    }
}

async function saveStore(id) {
    if (!sb) return;
    const updates = {
        has_parking: document.getElementById(`sm-parking-${id}`).checked,
        has_nursing_room: document.getElementById(`sm-nursing-${id}`).checked,
        has_highchair: document.getElementById(`sm-highchair-${id}`).checked,
        has_stroller_access: document.getElementById(`sm-stroller-${id}`).checked,
        phone: document.getElementById(`sm-phone-${id}`).value.trim() || null,
        hours: document.getElementById(`sm-hours-${id}`).value.trim() || null,
        playroom_type: document.getElementById(`sm-playroom-${id}`).value || null,
        playroom_desc: document.getElementById(`sm-playdesc-${id}`).value.trim() || null,
        price_range: document.getElementById(`sm-price-${id}`).value || '$$',
        age_range: document.getElementById(`sm-age-${id}`).value || '전연령',
    };
    const { error } = await sb.from('stores').update(updates).eq('id', id);
    if (error) { alert('저장 실패: ' + error.message); return; }
    // 로컬 데이터 업데이트
    allStores = allStores.map(s => s.id === id ? {...s, ...updates} : s);
    showToast('✅ 저장 완료!');
    renderStoreManage();
}

async function deleteStore(id, name) {
    if (!sb) return;
    if (!confirm(`"${name}"을 삭제하시겠습니까? 복구할 수 없습니다.`)) return;
    const { error } = await sb.from('stores').delete().eq('id', id);
    if (error) { alert('삭제 실패: ' + error.message); return; }
    allStores = allStores.filter(s => s.id !== id);
    showToast(`🗑️ "${name}" 삭제됐습니다.`);
    renderStoreManage();
}