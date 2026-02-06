// Utilidades de UI móvil sin cambiar lógicas existentes

(function() {
    function addDataLabelsToTable(table) {
        try {
            // No transformar tablas pivot ni las marcadas para conservar formato
            if (table.matches('.pivot-table') || table.getAttribute('data-keep-table') === 'true') {
                return;
            }
            const thead = table.querySelector('thead');
            const headerCells = thead ? Array.from(thead.querySelectorAll('th')) : [];
            const rows = Array.from(table.querySelectorAll('tbody tr'));

            rows.forEach(row => {
                const cells = Array.from(row.children);
                cells.forEach((cell, idx) => {
                    const label = headerCells[idx] ? headerCells[idx].innerText.trim() : '';
                    if (label) {
                        cell.setAttribute('data-label', label);
                    }
                });
            });

            // Añadir clase que convierte tabla a tarjetas en móvil
            table.classList.add('table-mobile-cards');
            table.setAttribute('data-mobile-cards', 'true');
        } catch (e) {
            console.warn('No se pudo transformar la tabla a tarjetas móviles:', e);
        }
    }

    function enhanceReportTablesMobile(root) {
        const scope = root || document;
        const tables = scope.querySelectorAll('table');
        tables.forEach(table => {
            if (!table.getAttribute('data-mobile-cards')) {
                addDataLabelsToTable(table);
            }
        });
    }

    function observeReportResults() {
        const container = document.getElementById('resultadosReporte');
        if (!container) return;
        const obs = new MutationObserver(() => {
            // Transformar nuevas tablas insertadas
            enhanceReportTablesMobile(container);
        });
        obs.observe(container, { childList: true, subtree: true });
    }

    function setupFiltersToggle() {
        const btn = document.getElementById('btnToggleFiltros');
        if (!btn) return;
        const panels = [
            document.getElementById('filtrosAvanzados'),
            document.getElementById('filtrosFechaMovimientos')
        ].filter(Boolean);

        const toggle = () => {
            const expanded = btn.getAttribute('aria-expanded') === 'true';
            const next = !expanded;
            btn.setAttribute('aria-expanded', String(next));
            panels.forEach(p => {
                // Solo colapsar si el panel está pensado para mostrarse actualmente
                if (window.innerWidth <= 768) {
                    if (next) {
                        p.classList.remove('is-collapsed');
                    } else {
                        p.classList.add('is-collapsed');
                    }
                }
            });
        };

        btn.addEventListener('click', toggle);

        // En móvil iniciar colapsados
        if (window.innerWidth <= 768) {
            panels.forEach(p => p.classList.add('is-collapsed'));
            btn.setAttribute('aria-expanded', 'false');
        }

        // Reaccionar a cambios de tamaño
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                panels.forEach(p => p.classList.remove('is-collapsed'));
                btn.setAttribute('aria-expanded', 'true');
            } else {
                panels.forEach(p => p.classList.add('is-collapsed'));
                btn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    function highlightActiveTabbar() {
        const tabbar = document.querySelector('.mobile-tabbar');
        if (!tabbar) return;
        const links = tabbar.querySelectorAll('a');
        const path = (location.pathname || '').split('/').pop();
        links.forEach(a => {
            const href = a.getAttribute('href');
            if (href === path) {
                a.classList.add('active');
            }
        });
    }

    document.addEventListener('DOMContentLoaded', function() {
        // Transformar tablas iniciales si estamos en la vista de reportes
        const enhanced = document.querySelector('#resultadosReporte[data-enhance-mobile="tables"]');
        if (enhanced) {
            enhanceReportTablesMobile(enhanced);
            observeReportResults();
        }

        setupFiltersToggle();
        highlightActiveTabbar();
    });
})();


