 /* 키즈고 - Main Application Script
 */
const state = {
    stores: [], filtered: [], userLocation: null, currentView: 'grid',
    filters: { category: [], subcategory: [], region: [], playroom: [], age: [], price: [], facilities: [], search: '', tag: '' },
    sort: 'rating'
};
const categoryIcons = { '식당': '🍽️', '카페': '☕', '키즈카페': '🎪', '뷔페': '🍱', '베이커리': '🍞' };
const subcategoryIcons = { '양식': '🍝', '한식': '🍚', '중식': '🥟', '일식': '🍣', '분식': '🍜', '고기집': '🥩', '횟집': '🐟', '술집/포차': '🍺', '치킨': '🍗', '샤브샤브': '🫕', '멕시칸': '🌮', '해물탕': '🦐', '디저트카페': '🍰', '브런치카페': '🥞', '빵집': '🥖', '뷔페': '🍱', '키즈전용': '🎠', '구이/BBQ': '🍖', '천곳/탕': '🥘', '피자': '🍕', '밥집': '🍚', '쿠키/베이킹': '🎂' };

function buildSubcategoryMap() {
    const map = {};
    state.stores.forEach(store => { if (!store.category || !store.subcategory) return; if (!map[store.category]) map[store.category] = new Set(); map[store.category].add(store.subcategory); });
    Object.keys(map).forEach(key => { map[key] = [...map[key]].sort(); });
    return map;
}

document.addEventListener('DOMContentLoaded', async () => { setupEventListeners(); setupScrollEffects(); await seedIfNeeded(); await loadStores(); });

async function loadStores() {
    showLoading(true);
    try {
        // Supabase 모드
        if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
            const response = await fetch(
                `${SUPABASE_URL}/rest/v1/stores?order=rating.desc&limit=1000`,
                { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
            );
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const data = await response.json();
            state.stores = data.map(store => ({
                ...store,
                tags: store.tags || [],
                id: String(store.id)
            }));
        } else {
            // 기존 tables API 폴백
            let allStores = []; const limit = 100;
            const firstRes = await fetch(`tables/stores?page=1&limit=${limit}`); const firstResult = await firstRes.json();
            let total = firstResult.total || 0; allStores = firstResult.data || [];
            if (allStores.length < limit && total > limit) {
                const totalPages = Math.ceil(total / limit);
                for (let p = 2; p <= totalPages; p++) {
                    const res = await fetch(`tables/stores?page=${p}&limit=${limit}`);
                    const result = await res.json();
                    allStores = allStores.concat(result.data || []);
                }
            }
            state.stores = allStores;
        }
        state.filtered = [...state.stores];
        state.subcategoryMap = buildSubcategoryMap();
        applySort();
        renderStores();
        console.log(`[DB] ${state.stores.length}개 가게 로드 완료`);
    } catch (error) {
        console.error('[DB] 로드 실패:', error);
        state.stores = []; state.filtered = []; renderStores();
        const grid = document.getElementById('storeGrid');
        if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:60px 20px;"><div style="font-size:3rem;margin-bottom:16px;">😢</div><h3 style="color:#2D3436;margin-bottom:8px;">데이터를 불러올 수 없어요</h3><p style="color:#636E72;font-size:0.9rem;">잠시 후 다시 시도해 주세요</p></div>';
    }
    showLoading(false);
}
function updateLoadingProgress(loaded, total) { const el = document.getElementById('loadingProgress'); if (el) { const pct = total > 0 ? Math.round((loaded / total) * 100) : 0; el.textContent = `${loaded}/${total}개 로딩 중... (${pct}%)`; } }

function setupEventListeners() {
    const searchInput = document.getElementById('searchInput'); const searchBtn = document.getElementById('searchBtn');
    if (searchBtn) searchBtn.addEventListener('click', () => performSearch());
    if (searchInput) { searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
    searchInput.addEventListener('input', debounce(() => { if (searchInput.value.length === 0) { state.filters.search = ''; state.filters.tag = ''; applyFilters(); } }, 300)); }
    document.querySelectorAll('.quick-tag').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.quick-tag').forEach(b => b.classList.remove('active'));
            const tag = btn.dataset.tag;
            if (state.filters.search === tag && state.filters.tag === tag) { state.filters.tag = ''; state.filters.search = ''; searchInput.value = ''; }
            else { btn.classList.add('active'); state.filters.tag = tag; state.filters.search = tag; searchInput.value = tag; }
            applyFilters();
        });
    });
    const locBtn = document.getElementById('locationBtn'); if (locBtn) locBtn.addEventListener('click', getLocation);
    const clrBtn = document.getElementById('clearLocationBtn'); if (clrBtn) clrBtn.addEventListener('click', clearLocation);
    const sortSel = document.getElementById('sortSelect'); if (sortSel) sortSel.addEventListener('change', (e) => { state.sort = e.target.value; applySort(); renderStores(); });
    const filterToggle = document.getElementById('filterToggle'); const filterPanel = document.getElementById('filterPanel');
    if (filterToggle && filterPanel) filterToggle.addEventListener('click', () => { filterPanel.classList.toggle('open'); filterToggle.classList.toggle('active'); });
    setupCategoryFilter(); setupFilterChips('regionFilter', 'region'); setupFilterChips('playroomFilter', 'playroom'); setupFilterChips('ageFilter', 'age'); setupFilterChips('priceFilter', 'price');
    document.querySelectorAll('#facilityFilter input').forEach(cb => { cb.addEventListener('change', () => { const facility = cb.dataset.facility; if (cb.checked) { if (!state.filters.facilities.includes(facility)) state.filters.facilities.push(facility); } else { state.filters.facilities = state.filters.facilities.filter(f => f !== facility); } }); });
    const resetBtn = document.getElementById('resetFilters'); if (resetBtn) resetBtn.addEventListener('click', resetFilters);
    const applyBtn = document.getElementById('applyFilters'); if (applyBtn) applyBtn.addEventListener('click', () => { applyFilters(); if(filterPanel) filterPanel.classList.remove('open'); if(filterToggle) filterToggle.classList.remove('active'); });
    document.querySelectorAll('.view-btn').forEach(btn => { btn.addEventListener('click', () => { document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active')); btn.classList.add('active'); state.currentView = btn.dataset.view; updateView(); }); });
    const detailModal = document.getElementById('detailModal'); if (detailModal) detailModal.addEventListener('click', (e) => { if (e.target === e.currentTarget) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

function setupFilterChips(containerId, filterKey) {
    const container = document.getElementById(containerId); if (!container) return;
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.dataset.value;
            if (val === 'all') { state.filters[filterKey] = []; container.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
            else { const allChip = container.querySelector('[data-value="all"]'); if (allChip) allChip.classList.remove('active'); chip.classList.toggle('active'); const arr = state.filters[filterKey]; const idx = arr.indexOf(val); if (idx > -1) arr.splice(idx, 1); else arr.push(val); if (arr.length === 0 && allChip) allChip.classList.add('active'); }
            updateChipCount(container, filterKey);
        });
    });
}
function updateChipCount(container, filterKey) { const group = container.closest('.filter-group'); if (!group) return; let badge = group.querySelector('.multi-count'); const count = state.filters[filterKey].length; if (count > 0) { if (!badge) { badge = document.createElement('span'); badge.className = 'multi-count'; group.querySelector('.filter-label').appendChild(badge); } badge.textContent = count; } else if (badge) { badge.remove(); } }

function setupCategoryFilter() {
    const container = document.getElementById('categoryFilter');
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.dataset.value;
            if (val === 'all') { state.filters.category = []; container.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
            else { const allChip = container.querySelector('[data-value="all"]'); if (allChip) allChip.classList.remove('active'); chip.classList.toggle('active'); const arr = state.filters.category; const idx = arr.indexOf(val); if (idx > -1) arr.splice(idx, 1); else arr.push(val); if (arr.length === 0 && allChip) allChip.classList.add('active'); }
            state.filters.subcategory = []; renderSubcategoryChips(); updateChipCount(container, 'category');
        });
    });
}
function renderSubcategoryChips() {
    const group = document.getElementById('subcategoryGroup'); const container = document.getElementById('subcategoryFilter'); const hint = document.getElementById('subcategoryHint'); const cats = state.filters.category;
    if (cats.length === 0 || !state.subcategoryMap) { group.style.display = 'none'; container.innerHTML = ''; return; }
    let allSubs = []; cats.forEach(cat => { const subs = state.subcategoryMap[cat] || []; subs.forEach(s => { if (!allSubs.includes(s)) allSubs.push(s); }); }); allSubs.sort();
    if (allSubs.length === 0) { group.style.display = 'none'; return; }
    const catLabels = cats.map(c => `${categoryIcons[c]||''} ${c}`).join(', '); hint.textContent = `(${catLabels} 세부)`;
    let html = '<button class="chip active" data-value="all">전체</button>'; allSubs.forEach(sub => { const icon = subcategoryIcons[sub] || '🍽️'; const isActive = state.filters.subcategory.includes(sub) ? ' active' : ''; html += `<button class="chip${isActive}" data-value="${sub}">${icon} ${sub}</button>`; });
    container.innerHTML = html; group.style.display = 'block'; group.classList.remove('subcategory-appear'); void group.offsetWidth; group.classList.add('subcategory-appear');
    const allChip = container.querySelector('[data-value="all"]'); if (state.filters.subcategory.length > 0 && allChip) allChip.classList.remove('active');
    container.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            const val = chip.dataset.value;
            if (val === 'all') { state.filters.subcategory = []; container.querySelectorAll('.chip').forEach(c => c.classList.remove('active')); chip.classList.add('active'); }
            else { if (allChip) allChip.classList.remove('active'); chip.classList.toggle('active'); const arr = state.filters.subcategory; const idx = arr.indexOf(val); if (idx > -1) arr.splice(idx, 1); else arr.push(val); if (arr.length === 0 && allChip) allChip.classList.add('active'); }
            updateChipCount(container, 'subcategory');
        });
    });
}

function performSearch() { const query = document.getElementById('searchInput').value.trim(); state.filters.search = query; state.filters.tag = ''; document.querySelectorAll('.quick-tag').forEach(b => b.classList.remove('active')); applyFilters(); }

function getLocation() {
    const btn = document.getElementById('locationBtn'); btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>위치 확인 중...</span>';
    if (!navigator.geolocation) { alert('이 브라우저에서는 위치 서비스를 지원하지 않습니다.'); btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> <span>내 위치로 찾기</span>'; return; }
    navigator.geolocation.getCurrentPosition(
        (position) => {
            state.userLocation = { lat: position.coords.latitude, lng: position.coords.longitude };
            btn.style.display = 'none'; const info = document.getElementById('locationInfo'); info.style.display = 'flex';
            document.getElementById('locationText').textContent = `현재 위치 (${state.userLocation.lat.toFixed(4)}, ${state.userLocation.lng.toFixed(4)})`;
            if (state.sort === 'distance') { applySort(); renderStores(); }
            state.stores.forEach(store => { if (store.lat && store.lng) { store._distance = calculateDistance(state.userLocation.lat, state.userLocation.lng, store.lat, store.lng); } });
            applyFilters();
            if (state.currentView === 'map' && kakaoMap) {
            renderMap();
            kakaoMap.setCenter(new kakao.maps.LatLng(state.userLocation.lat, state.userLocation.lng));
            kakaoMap.setLevel(5);
            }
        },
        (error) => { let msg = '위치를 가져올 수 없습니다.'; if (error.code === 1) msg = '위치 권한이 거부되었습니다. 설정에서 허용해주세요.'; alert(msg); btn.innerHTML = '<i class="fas fa-location-crosshairs"></i> <span>내 위치로 찾기</span>'; },
        { enableHighAccuracy: true, timeout: 10000 }
    );
}
function clearLocation() { state.userLocation = null; state.stores.forEach(s => delete s._distance); document.getElementById('locationBtn').style.display = 'flex'; document.getElementById('locationBtn').innerHTML = '<i class="fas fa-location-crosshairs"></i> <span>내 위치로 찾기</span>'; document.getElementById('locationInfo').style.display = 'none'; applyFilters(); }
function calculateDistance(lat1, lon1, lat2, lon2) { const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180; const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2); const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c; }
function formatDistance(km) { if (km < 1) return `${Math.round(km * 1000)}m`; return `${km.toFixed(1)}km`; }

function applyFilters() {
    const f = state.filters;
    state.filtered = state.stores.filter(store => {
        if (f.category.length > 0 && !f.category.includes(store.category)) return false;
        if (f.subcategory.length > 0 && !f.subcategory.includes(store.subcategory)) return false;
        if (f.region.length > 0 && !f.region.includes(store.region)) return false;
        if (f.playroom.length > 0 && !f.playroom.includes(store.playroom_type)) return false;
        if (f.age.length > 0 && !f.age.includes(store.age_range)) return false;
        if (f.price.length > 0 && !f.price.includes(store.price_range)) return false;
        for (const fac of f.facilities) { if (!store[fac]) return false; }
        if (f.search || f.tag) {
            const searchable = [store.name, store.address, store.category, store.subcategory, store.region, store.district, store.description, store.playroom_desc, ...(store.tags || [])].join(' ').toLowerCase();
            let matchSearch = true; let matchTag = true;
            if (f.search) matchSearch = searchable.includes(f.search.toLowerCase());
            if (f.tag) { const tags = (store.tags || []).map(t => t.toLowerCase()); const tagSearch = f.tag.toLowerCase(); matchTag = tags.some(t => t.includes(tagSearch)); }
            if (f.search && f.tag && f.search === f.tag) { if (!matchSearch && !matchTag) return false; } else { if (f.search && !matchSearch) return false; if (f.tag && !matchTag) return false; }
        }
        return true;
    });
    let activeCount = 0; activeCount += f.category.length; activeCount += f.subcategory.length; activeCount += f.region.length; activeCount += f.playroom.length; activeCount += f.age.length; activeCount += f.price.length; activeCount += f.facilities.length;
    const filterCountEl = document.getElementById('filterCount'); if (filterCountEl) { if (activeCount > 0) { filterCountEl.textContent = activeCount; filterCountEl.style.display = 'inline-flex'; } else { filterCountEl.style.display = 'none'; } }
    applySort(); renderStores(); updateResultsTitle();
}
function resetFilters() {
    state.filters = { category: [], subcategory: [], region: [], playroom: [], age: [], price: [], facilities: [], search: '', tag: '' };
    document.querySelectorAll('.filter-chips .chip').forEach(chip => { chip.classList.toggle('active', chip.dataset.value === 'all'); });
    document.querySelectorAll('#facilityFilter input').forEach(cb => cb.checked = false);
    document.getElementById('searchInput').value = ''; document.querySelectorAll('.quick-tag').forEach(b => b.classList.remove('active'));
    const fc = document.getElementById('filterCount'); if (fc) fc.style.display = 'none'; document.querySelectorAll('.multi-count').forEach(el => el.remove());
    const sg = document.getElementById('subcategoryGroup'); if (sg) sg.style.display = 'none'; const sf = document.getElementById('subcategoryFilter'); if (sf) sf.innerHTML = '';
    applyFilters();
}
function resetAll() { resetFilters(); const fp = document.getElementById('filterPanel'); if (fp) fp.classList.remove('open'); const ft = document.getElementById('filterToggle'); if (ft) ft.classList.remove('active'); window.scrollTo({ top: 0, behavior: 'smooth' }); }

function applySort() {
    const s = state.sort;
    state.filtered.sort((a, b) => {
        switch (s) { case 'rating': return (b.rating || 0) - (a.rating || 0); case 'review': return (b.review_count || 0) - (a.review_count || 0); case 'distance': return (a._distance || 9999) - (b._distance || 9999); case 'price_low': return (a.price_range || '').length - (b.price_range || '').length; case 'price_high': return (b.price_range || '').length - (a.price_range || '').length; default: return 0; }
    });
}

function renderStores() {
    const grid = document.getElementById('storeGrid'); const emptyState = document.getElementById('emptyState') || document.getElementById('noResults'); const countEl = document.getElementById('resultsCount') || document.getElementById('resultCount');
    if (countEl) countEl.textContent = `${state.filtered.length}개`;
    if (!grid) return;
    if (state.filtered.length === 0) { grid.innerHTML = ''; if (emptyState) emptyState.style.display = 'block'; return; }
    if (emptyState) emptyState.style.display = 'none'; grid.innerHTML = state.filtered.map(store => createStoreCard(store)).join('');
    if (state.currentView === 'map') renderMap();
}
function createStoreCard(store) {
    const icon = categoryIcons[store.category] || '🏠'; const subIcon = subcategoryIcons[store.subcategory] || icon; const stars = renderStars(store.rating || 0);
    let distanceHtml = ''; if (store._distance !== undefined) { distanceHtml = `<span class="card-distance"><i class="fas fa-location-dot"></i> ${formatDistance(store._distance)}</span>`; }
    const facilities = []; if (store.has_parking) facilities.push('<span class="facility-badge"><i class="fas fa-parking"></i> 주차</span>'); if (store.has_nursing_room) facilities.push('<span class="facility-badge"><i class="fas fa-baby-carriage"></i> 수유실</span>'); if (store.has_highchair) facilities.push('<span class="facility-badge"><i class="fas fa-chair"></i> 유아의자</span>'); if (store.has_stroller_access) facilities.push('<span class="facility-badge"><i class="fas fa-wheelchair"></i> 유모차</span>');
    const tags = (store.tags || []).map(tag => `<span class="tag">#${tag}</span>`).join('');
    return `<div class="store-card" onclick="openDetail('${store.id}')"><div class="card-image"><span class="card-image-icon">${subIcon}</span><div class="card-badges"><span class="badge badge-category">${icon} ${store.category}</span><span class="badge badge-playroom">🎈 ${store.playroom_type || ''}</span></div>${distanceHtml}</div><div class="card-body"><div class="card-title">${store.name}<span class="price-tag">${store.price_range || ''}</span></div><div class="card-location"><i class="fas fa-map-marker-alt"></i>${store.district ? store.region + ' ' + store.district : store.address}</div><div class="card-rating"><span class="stars">${stars}</span><span class="rating-num">${(store.rating || 0).toFixed(1)}</span><span class="review-count">리뷰 ${store.review_count || 0}개</span></div><p class="card-desc">${store.description || ''}</p><div class="card-facilities">${facilities.join('')}</div><div class="card-tags">${tags}</div></div></div>`;
}
function renderStars(rating) { let stars = ''; const full = Math.floor(rating); const half = rating % 1 >= 0.5; for (let i = 0; i < full; i++) stars += '★'; if (half) stars += '★'; for (let i = stars.length; i < 5; i++) stars += '☆'; return stars; }
function updateResultsTitle() { const title = document.getElementById('resultsTitle'); const parts = []; if (state.filters.region.length > 0) parts.push(state.filters.region.join('·')); if (state.filters.category.length > 0) parts.push(state.filters.category.join('·')); if (state.filters.subcategory.length > 0) parts.push(state.filters.subcategory.join('·')); if (state.filters.search) parts.push(`"${state.filters.search}"`); if (state.filters.tag) parts.push(`#${state.filters.tag}`); title.textContent = parts.length > 0 ? `${parts.join(' ')} 검색 결과` : '전체 키즈 프렌들리 가게'; }

function updateView() {
    const grid = document.getElementById('storeGrid'); const mapContainer = document.getElementById('mapContainer');
    grid.classList.remove('list-view'); mapContainer.style.display = 'none';
    switch (state.currentView) { case 'list': grid.classList.add('list-view'); grid.style.display = 'grid'; break; case 'map': mapContainer.style.display = 'block'; grid.style.display = 'grid'; renderMap(); break;
 default: grid.style.display = 'grid'; }
}
let kakaoMap = null, kakaoClusterer = null;
function renderMap() {
    const stores = state.filtered.filter(s => s.lat && s.lng);
    if (!kakaoMap) {
        const container = document.getElementById('kakaoMap');
        kakaoMap = new kakao.maps.Map(container, { center: new kakao.maps.LatLng(37.5665, 126.9780), level: 8 });
        kakaoMap.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT);
        kakaoClusterer = new kakao.maps.MarkerClusterer({ map: kakaoMap, averageCenter: true, minLevel: 5 });
    }
    kakaoClusterer.clear();
    if (!stores.length) return;
    const iw = new kakao.maps.InfoWindow({ zIndex: 10 });
    const markers = stores.map(store => {
        const m = new kakao.maps.Marker({ position: new kakao.maps.LatLng(store.lat, store.lng) });
        kakao.maps.event.addListener(m, 'click', function() {
            iw.setContent('<div style="padding:8px 12px;cursor:pointer;font-size:0.85rem;font-weight:600;" onclick="openDetail(\'' + store.id + '\')">' + store.name + '<br><span style="color:#FF6B9D;font-size:0.75rem;">' + (store.category||'') + '</span></div>');
            iw.open(kakaoMap, m);
        });
        return m;
    });
    kakaoClusterer.addMarkers(markers);
    const bounds = new kakao.maps.LatLngBounds();
    stores.forEach(s => bounds.extend(new kakao.maps.LatLng(s.lat, s.lng)));
    if (stores.length > 1) kakaoMap.setBounds(bounds);
    else { kakaoMap.setCenter(new kakao.maps.LatLng(stores[0].lat, stores[0].lng)); kakaoMap.setLevel(5); }
    if (state.userLocation) {
        new kakao.maps.Marker({
            position: new kakao.maps.LatLng(state.userLocation.lat, state.userLocation.lng),
            map: kakaoMap,
            image: new kakao.maps.MarkerImage('https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png', new kakao.maps.Size(24, 35))
        });
    }
    kakao.maps.event.addListener(kakaoMap, 'click', function() { iw.close(); });
}
function openDetail(id) {
    const store = state.stores.find(s => s.id === id); if (!store) return;
    const modal = document.getElementById('detailModal'); const body = document.getElementById('modalBody');
    const icon = categoryIcons[store.category] || '🏠'; const subIcon = subcategoryIcons[store.subcategory] || icon; const stars = renderStars(store.rating || 0);
    const facilityItems = [ { key: 'has_parking', icon: 'fa-parking', label: '주차 가능' }, { key: 'has_nursing_room', icon: 'fa-baby-carriage', label: '수유실' }, { key: 'has_highchair', icon: 'fa-chair', label: '유아 의자' }, { key: 'has_stroller_access', icon: 'fa-wheelchair', label: '유모차 접근' } ];
    const facilitiesHtml = facilityItems.map(f => { const available = store[f.key]; return `<div class="modal-facility ${available ? 'available' : 'unavailable'}"><i class="fas ${f.icon}"></i>${f.label}${available ? '<i class="fas fa-check" style="margin-left:4px;font-size:0.7rem;"></i>' : '<i class="fas fa-times" style="margin-left:4px;font-size:0.7rem;"></i>'}</div>`; }).join('');
    const tagsHtml = (store.tags || []).map(tag => `<span class="modal-tag">#${tag}</span>`).join('');
    let distanceInfo = ''; if (store._distance !== undefined) { distanceInfo = `<div class="modal-info-item"><i class="fas fa-route"></i><div><div class="info-label">거리</div><div class="info-value">${formatDistance(store._distance)} (직선거리)</div></div></div>`; }
    const directionsUrl = state.userLocation
        ? `https://map.kakao.com/link/from/내위치,${state.userLocation.lat},${state.userLocation.lng}/to/${encodeURIComponent(store.name)},${store.lat},${store.lng}`
        : `https://map.kakao.com/link/to/${encodeURIComponent(store.name)},${store.lat},${store.lng}`;
    body.innerHTML = `<div class="modal-hero">${subIcon}</div><div class="modal-content"><div class="modal-title">${store.name}</div><div class="modal-subtitle">${store.category} · ${store.subcategory || ''} · ${store.price_range || ''}</div><div class="modal-rating"><span class="stars">${stars}</span><span class="rating-num">${(store.rating || 0).toFixed(1)}</span><span class="review-count">리뷰 ${store.review_count || 0}개</span></div><p style="font-size:0.92rem;line-height:1.7;color:var(--text);margin-bottom:20px;">${store.description || ''}</p><div class="modal-info-grid"><div class="modal-info-item"><i class="fas fa-map-marker-alt"></i><div><div class="info-label">주소</div><div class="info-value">${store.address || ''}</div></div></div><div class="modal-info-item"><i class="fas fa-phone"></i><div><div class="info-label">전화</div><div class="info-value">${store.phone || '정보 없음'}</div></div></div><div class="modal-info-item"><i class="fas fa-clock"></i><div><div class="info-label">영업시간</div><div class="info-value">${store.hours || '정보 없음'}</div></div></div><div class="modal-info-item"><i class="fas fa-child"></i><div><div class="info-label">권장 연령</div><div class="info-value">${store.age_range || '전연령'}</div></div></div>${distanceInfo}</div><div class="modal-section"><div class="modal-section-title"><i class="fas fa-puzzle-piece"></i> 놀이시설 정보</div><div style="margin-bottom:8px;"><span class="badge badge-playroom" style="font-size:0.85rem;padding:6px 14px;">🎈 ${store.playroom_type || ''}</span></div><div class="playroom-desc">${store.playroom_desc || '상세 정보가 없습니다.'}</div></div><div class="modal-section"><div class="modal-section-title"><i class="fas fa-check-circle"></i> 편의시설</div><div class="modal-facilities">${facilitiesHtml}</div></div>${tagsHtml ? `<div class="modal-section"><div class="modal-section-title"><i class="fas fa-hashtag"></i> 태그</div><div class="modal-tags">${tagsHtml}</div></div>` : ''}<div class="modal-cta"><a href="tel:${store.phone || ''}" class="btn-call" onclick="event.stopPropagation();"><i class="fas fa-phone"></i> 전화하기</a><a href="${directionsUrl}" target="_blank" class="btn-directions" onclick="event.stopPropagation();"><i class="fas fa-directions"></i> 길찾기</a></div></div>`;
    modal.style.display = 'flex'; document.body.style.overflow = 'hidden';
}
function closeModal() { document.getElementById('detailModal').style.display = 'none'; document.body.style.overflow = ''; }
function setupScrollEffects() { const backToTop = document.getElementById('backToTop'); window.addEventListener('scroll', () => { backToTop.style.display = window.scrollY > 400 ? 'flex' : 'none'; }); backToTop.addEventListener('click', () => { window.scrollTo({ top: 0, behavior: 'smooth' }); }); }
function showLoading(show) { document.getElementById('loading').style.display = show ? 'block' : 'none'; }
function debounce(func, wait) { let timeout; return function executedFunction(...args) { clearTimeout(timeout); timeout = setTimeout(() => func.apply(this, args), wait); }; }
