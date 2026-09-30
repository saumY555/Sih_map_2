/**
 * CMPDIPS — Frontend Application
 * ================================
 * Leaflet map with marker clustering, filter pills, mine selection,
 * and live document preview panel.
 */

(function () {
    'use strict';

    // ── State ──
    let map;
    let clusterGroup;
    let allFeatures = [];
    let selectedMineId = null;
    let currentTab = 'document'; // 'document' | 'reports'
    let currentReportId = null;

    // ── DOM refs ──
    const $mapEl = document.getElementById('map');
    const $previewContent = document.getElementById('previewContent');
    const $emptyState = document.getElementById('emptyState');
    const $mapMineCount = document.getElementById('mapMineCount');
    const $menuSubsidiary = document.getElementById('menuSubsidiary');
    const $labelSubsidiary = document.getElementById('labelSubsidiary');
    const $menuType = document.getElementById('menuType');
    const $labelType = document.getElementById('labelType');
    const $menuState = document.getElementById('menuState');
    const $labelState = document.getElementById('labelState');
    const $mapSearch = document.getElementById('mapSearch');
    const $globalSearch = document.getElementById('globalSearch');
    const $statMines = document.getElementById('statMines');
    const $statReports = document.getElementById('statReports');
    const $statStates = document.getElementById('statStates');

    // ── Active Filters ──
    const activeFilters = {
        subsidiary: '',
        type: '',
        state: '',
    };

    // ── Custom pointed map pin icon ──
    function mineIcon(type) {
        const colors = {
            Opencast: '#f59e0b',
            Underground: '#3b82f6',
            Mixed: '#8b5cf6',
        };
        const color = colors[type] || '#76d636';
        return L.divIcon({
            className: 'mine-pin-container',
            html: `
                <div class="mine-pin-wrapper">
                    <svg class="mine-pin-svg" viewBox="0 0 26 36" width="26" height="36" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M13 0C5.82 0 0 5.82 0 13C0 22.75 11.5 34.6 12.35 35.45C12.72 35.82 13.28 35.82 13.65 35.45C14.5 34.6 26 22.75 26 13C26 5.82 20.18 0 13 0Z" fill="${color}" stroke="#ffffff" stroke-width="1.5" />
                        <circle cx="13" cy="13" r="5" fill="#ffffff"/>
                        <circle cx="13" cy="13" r="2.5" fill="${color}"/>
                    </svg>
                    <div class="mine-pin-pulse"></div>
                </div>
            `,
            iconSize: [26, 36],
            iconAnchor: [13, 36],
            popupAnchor: [0, -36],
            tooltipAnchor: [0, -36],
        });
    }

    // ── Init Map ──
    function initMap() {
        map = L.map($mapEl, {
            center: [22.5, 82.5],
            zoom: 5,
            zoomControl: true,
            scrollWheelZoom: true,
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
            maxZoom: 18,
        }).addTo(map);

        clusterGroup = L.markerClusterGroup({
            maxClusterRadius: 50,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            iconCreateFunction: function (cluster) {
                const count = cluster.getChildCount();
                let size = 'small';
                if (count > 20) size = 'large';
                else if (count > 10) size = 'medium';
                return L.divIcon({
                    html: `<div style="
                        display:flex;align-items:center;justify-content:center;
                        width:${size === 'large' ? 48 : size === 'medium' ? 40 : 34}px;
                        height:${size === 'large' ? 48 : size === 'medium' ? 40 : 34}px;
                        border-radius:50%;
                        background:rgba(118,214,54,0.85);
                        color:#fff;font-weight:700;font-size:${size === 'large' ? 14 : 12}px;
                        font-family:Inter,sans-serif;
                        box-shadow:0 2px 8px rgba(118,214,54,0.4);
                        border:2.5px solid #fff;
                    ">${count}</div>`,
                    className: '',
                    iconSize: [size === 'large' ? 48 : size === 'medium' ? 40 : 34,
                               size === 'large' ? 48 : size === 'medium' ? 40 : 34],
                });
            },
        });

        map.addLayer(clusterGroup);
    }

    // ── Fetch & Render Mines ──
    async function loadMines() {
        const params = new URLSearchParams();
        if (activeFilters.subsidiary) params.set('subsidiary', activeFilters.subsidiary);
        if (activeFilters.type) params.set('type', activeFilters.type);
        if (activeFilters.state) params.set('state', activeFilters.state);
        if ($mapSearch && $mapSearch.value.trim()) params.set('search', $mapSearch.value.trim());

        try {
            const resp = await fetch(`/api/mines?${params}`);
            const geojson = await resp.json();
            allFeatures = geojson.features || [];
            renderMarkers(allFeatures);
            if ($mapMineCount) $mapMineCount.textContent = `${allFeatures.length} mines`;
        } catch (err) {
            console.error('Failed to load mines:', err);
            if ($mapMineCount) $mapMineCount.textContent = 'Error';
        }
    }

    function renderMarkers(features) {
        clusterGroup.clearLayers();
        features.forEach(f => {
            const [lng, lat] = f.geometry.coordinates;
            const p = f.properties;
            const marker = L.marker([lat, lng], { icon: mineIcon(p.type) });

            // Tooltip showing the mine name and subsidiary/company badge on hover
            const subsidiary = p.subsidiary || 'CIL';
            const subClass = subsidiary.toLowerCase().replace(/[^a-z0-9]/g, '');
            marker.bindTooltip(`
                <div class="mine-pin-label">
                    <span class="mine-pin-name">${escHtml(p.name)}</span>
                    <span class="mine-pin-tag sub-${subClass}">${escHtml(subsidiary)}</span>
                </div>
            `, {
                permanent: false,
                direction: 'top',
                offset: [0, -34],
                className: 'mine-tooltip-custom',
                opacity: 1
            });

            marker.bindPopup(`
                <div class="mine-popup">
                    <h3>${escHtml(p.name)}</h3>
                    <p><strong>Subsidiary:</strong> ${escHtml(p.subsidiary)}</p>
                    <p><strong>State:</strong> ${escHtml(p.state)}${p.district ? ', ' + escHtml(p.district) : ''}</p>
                    <p><strong>Type:</strong> ${escHtml(p.type)}</p>
                    <button class="popup-btn" onclick="window.__selectMine('${p.mine_id}')">
                        View Reports →
                    </button>
                </div>
            `, { maxWidth: 260 });

            // On marker click, also directly load preview
            marker.on('click', () => {
                window.__selectMine(p.mine_id);
            });

            clusterGroup.addLayer(marker);
        });
    }

    // ── Global: select mine from popup ──
    window.__selectMine = function (mineId) {
        selectedMineId = mineId;
        currentReportId = null;
        loadMinePreview(mineId);
        map.closePopup();
    };

    // ── Load Mine Preview ──
    async function loadMinePreview(mineId) {
        $previewContent.innerHTML = '<div class="spinner"></div>';
        try {
            const [mineResp, reportsResp] = await Promise.all([
                fetch(`/api/mines/${mineId}`),
                fetch(`/api/mines/${mineId}/reports`),
            ]);
            const mine = await mineResp.json();
            const reportsData = await reportsResp.json();

            if (currentTab === 'document' || currentTab === 'reports') {
                renderMineView(mine, reportsData.reports || []);
            }
        } catch (err) {
            console.error('Failed to load mine preview:', err);
            $previewContent.innerHTML = '<p style="color:#ef4444;padding:20px;">Failed to load data.</p>';
        }
    }

    function renderMineView(mine, reports) {
        const typeClass = (mine.type || '').toLowerCase();
        let html = `
            <div class="fade-in">
                <div class="mine-info-header">
                    <div>
                        <h2>${escHtml(mine.name)}</h2>
                        <p>${escHtml(mine.subsidiary)} · ${escHtml(mine.state)}${mine.district ? ', ' + escHtml(mine.district) : ''}</p>
                        <p style="margin-top:4px;font-size:11px;color:#94a3b8;">ID: ${escHtml(mine.mine_id)}</p>
                    </div>
                    <span class="mine-type-badge ${typeClass}">${escHtml(mine.type)}</span>
                </div>
        `;

        if (currentTab === 'reports') {
            // Show report list
            html += '<div class="report-list">';
            if (reports.length === 0) {
                html += '<p style="color:#94a3b8;font-size:13px;">No reports found.</p>';
            }
            reports.forEach(r => {
                html += `
                    <div class="report-list-item" onclick="window.__loadReport('${r.report_id}')">
                        <div class="report-item-info">
                            <h4>${escHtml(r.title)}</h4>
                            <p>${escHtml(r.format)}</p>
                        </div>
                        <div class="report-item-meta">
                            <span class="report-year-badge">${r.year}</span>
                            <span class="report-confidence">${(r.confidence_score * 100).toFixed(1)}%</span>
                        </div>
                    </div>
                `;
            });
            html += '</div>';
        } else {
            // Document tab: show first report by default, or selected report
            if (reports.length > 0) {
                const targetId = currentReportId || reports[0].report_id;
                html += `<div id="docContent"><div class="spinner"></div></div>`;
                // Also show report selector
                html += '<div class="report-list" style="margin-top:20px;">';
                html += '<h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:#64748b;">All Reports</h4>';
                reports.forEach(r => {
                    const isActive = r.report_id === targetId ? ' active' : '';
                    html += `
                        <div class="report-list-item${isActive}" onclick="window.__loadReport('${r.report_id}')">
                            <div class="report-item-info">
                                <h4>${escHtml(r.title)}</h4>
                                <p>${escHtml(r.format)}</p>
                            </div>
                            <div class="report-item-meta">
                                <span class="report-year-badge">${r.year}</span>
                                <span class="report-confidence">${(r.confidence_score * 100).toFixed(1)}%</span>
                            </div>
                        </div>
                    `;
                });
                html += '</div>';
                // Fetch and render the document
                setTimeout(() => loadReportDocument(targetId), 50);
            } else {
                html += '<p style="color:#94a3b8;font-size:13px;">No reports available for this mine.</p>';
            }
        }

        html += '</div>';
        $previewContent.innerHTML = html;
    }

    // ── Load Single Report Document ──
    window.__loadReport = async function (reportId) {
        currentReportId = reportId;
        if (selectedMineId) {
            currentTab = 'document';
            // Update tab UI
            document.querySelectorAll('.preview-tab').forEach(t => {
                t.classList.toggle('active', t.dataset.tab === 'document');
            });
            loadMinePreview(selectedMineId);
        }
    };

    async function loadReportDocument(reportId) {
        const $docContent = document.getElementById('docContent');
        if (!$docContent) return;
        try {
            const resp = await fetch(`/api/reports/${reportId}`);
            const report = await resp.json();
            $docContent.innerHTML = `<div class="fade-in">${report.content}</div>`;
        } catch (err) {
            $docContent.innerHTML = '<p style="color:#ef4444;">Failed to load report.</p>';
        }
    }

    // ── Helper to build custom hover dropdowns ──
    function setupHoverDropdown($menu, $label, filterKey, defaultLabel, items) {
        if (!$menu || !$label) return;

        $menu.innerHTML = '';

        // Default 'All' item
        const $allItem = document.createElement('div');
        $allItem.className = `dropdown-item ${activeFilters[filterKey] === '' ? 'active' : ''}`;
        $allItem.textContent = defaultLabel;
        $allItem.dataset.value = '';
        $allItem.addEventListener('click', () => {
            activeFilters[filterKey] = '';
            $label.textContent = 'All';
            $menu.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
            $allItem.classList.add('active');
            loadMines();
        });
        $menu.appendChild($allItem);

        // Individual items
        items.forEach(val => {
            const $item = document.createElement('div');
            $item.className = `dropdown-item ${activeFilters[filterKey] === val ? 'active' : ''}`;
            $item.textContent = val;
            $item.dataset.value = val;
            $item.addEventListener('click', () => {
                activeFilters[filterKey] = val;
                $label.textContent = val;
                $menu.querySelectorAll('.dropdown-item').forEach(el => el.classList.remove('active'));
                $item.classList.add('active');
                loadMines();
            });
            $menu.appendChild($item);
        });
    }

    // ── Load Stats & Build Dropdowns ──
    async function loadStats() {
        try {
            const resp = await fetch('/api/stats');
            const stats = await resp.json();
            if ($statMines) $statMines.textContent = stats.mine_count;
            if ($statReports) $statReports.textContent = stats.report_count;
            if ($statStates) $statStates.textContent = stats.states.length;

            // Populate custom hover dropdown menus
            setupHoverDropdown($menuSubsidiary, $labelSubsidiary, 'subsidiary', 'All Subsidiaries', stats.subsidiaries);
            setupHoverDropdown($menuType, $labelType, 'type', 'All Types', stats.types);
            setupHoverDropdown($menuState, $labelState, 'state', 'All States', stats.states);
        } catch (err) {
            console.error('Stats fetch failed:', err);
        }
    }

    // ── Tab Switching ──
    document.querySelectorAll('.preview-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.preview-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.dataset.tab;
            if (selectedMineId) {
                loadMinePreview(selectedMineId);
            }
        });
    });

    // ── Search Filter Events ──
    let searchTimeout;
    if ($mapSearch) {
        $mapSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(loadMines, 350);
        });
    }
    if ($globalSearch) {
        $globalSearch.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            if ($mapSearch) $mapSearch.value = $globalSearch.value;
            searchTimeout = setTimeout(loadMines, 350);
        });
    }

    // ── Utility ──
    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ── Boot ──
    document.addEventListener('DOMContentLoaded', () => {
        initMap();
        loadStats();
        loadMines();
    });
})();
