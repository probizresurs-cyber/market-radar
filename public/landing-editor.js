/*
 * Инлайн-редактор лендинга.
 *
 * Встраивается в самодостаточный HTML лендинга (/l/[slug]) отдельным тегом
 * <script>. Даёт кнопку «Редактировать» → пароль → правку текста прямо на месте
 * и замену/генерацию картинок, затем сохраняет изменённый HTML обратно в базу.
 *
 * Первый этап: текст и картинки. Перемещение блоков и шрифты — следующим шагом.
 *
 * Весь свой интерфейс редактор держит на элементах с префиксом __le и с инлайн-
 * стилями поверх чужих: лендинг чужой, его вёрстку и классы трогать нельзя. При
 * сохранении редакторская обвязка снимается, в базу уходит чистый документ.
 */
(function () {
    'use strict';

    var script = document.currentScript;
    // id — что правим: slug лендинга market-radar или путь статической страницы
    // Mida. save/generate — куда слать; по умолчанию — API market-radar, чтобы
    // на лендингах /l/[slug] всё работало без атрибутов.
    var slug = (script && (script.dataset.slug || script.dataset.id)) || '';
    var SAVE_URL = (script && script.dataset.save) || '/api/landing-edit-save';
    var GEN_URL = (script && script.dataset.generate) || '/api/generate-image-anthropic';
    if (!slug) return;

    var editing = false;

    // ── плавающая кнопка «Редактировать» ──────────────────────────────────────
    var launcher = el('button', {
        id: '__le_launch',
        textContent: '✎ Редактировать',
        style: css({
            position: 'fixed', right: '16px', bottom: '16px', zIndex: 2147483000,
            padding: '10px 16px', borderRadius: '999px', border: 'none',
            background: '#7c3aed', color: '#fff', font: '600 14px system-ui, sans-serif',
            boxShadow: '0 4px 14px rgba(0,0,0,.25)', cursor: 'pointer',
        }),
    });
    launcher.addEventListener('click', askPassword);
    document.body.appendChild(launcher);

    // ── вход по паролю ────────────────────────────────────────────────────────
    function askPassword() {
        var pw = window.prompt('Пароль для редактирования:');
        if (pw == null) return;
        fetch(SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, path: slug, password: pw, check: true }),
        })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.ok) { sessionStorage.setItem('__le_pw', pw); enterEdit(); }
                else alert('Неверный пароль');
            })
            .catch(function () { alert('Нет связи с сервером'); });
    }

    // ── режим редактирования ──────────────────────────────────────────────────
    var TEXT_TAGS = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'P', 'SPAN', 'A', 'LI', 'BUTTON', 'STRONG', 'EM', 'BLOCKQUOTE', 'FIGCAPTION', 'LABEL', 'TD', 'TH'];

    function enterEdit() {
        if (editing) return;
        editing = true;
        launcher.style.display = 'none';
        buildBar();

        // Текст: правим листовые элементы — те, где нет вложенных блоков, иначе
        // contentEditable на родителе мешал бы точечной правке.
        document.querySelectorAll(TEXT_TAGS.join(',')).forEach(function (node) {
            if (node.closest('#__le_bar')) return;
            if (hasBlockChild(node)) return;
            node.setAttribute('contenteditable', 'true');
            node.setAttribute('data-le-text', '1');
            node.style.outline = '1px dashed rgba(124,58,237,.4)';
            node.style.outlineOffset = '2px';
        });

        // Картинки: клик открывает меню замены.
        document.querySelectorAll('img').forEach(function (img) {
            if (img.closest('#__le_bar')) return;
            img.setAttribute('data-le-img', '1');
            img.style.cursor = 'pointer';
            img.style.outline = '2px solid rgba(124,58,237,.5)';
            img.addEventListener('click', onImageClick);
        });

        markSections();  // перемещение блоков вверх/вниз
        buildFontBar();  // шрифт и размер для выбранного текста
    }

    // ── перемещение блоков (секций верхнего уровня) ───────────────────────────
    function topBlocks() {
        return Array.prototype.filter.call(document.body.children, function (n) {
            if (n.id && n.id.indexOf('__le') === 0) return false;
            if (n.tagName === 'SCRIPT' || n.tagName === 'STYLE') return false;
            var d = getComputedStyle(n).display;
            return d !== 'none' && n.offsetHeight > 0;
        });
    }

    function markSections() {
        topBlocks().forEach(function (block) {
            if (getComputedStyle(block).position === 'static') {
                block.setAttribute('data-le-pos', block.style.position || '');
                block.style.position = 'relative';
            }
            var ctl = el('div', {
                'data-le-handle': '1',
                style: css({
                    position: 'absolute', top: '6px', right: '6px', zIndex: 2147482000,
                    display: 'flex', gap: '4px', padding: '3px',
                    background: 'rgba(17,17,17,.85)', borderRadius: '8px',
                }),
            });
            ctl.innerHTML =
                '<button title="Выше" data-le-up style="' + hbtn() + '">▲</button>' +
                '<button title="Ниже" data-le-down style="' + hbtn() + '">▼</button>' +
                '<button title="Удалить блок" data-le-del style="' + hbtn() + '">✕</button>';
            ctl.querySelector('[data-le-up]').addEventListener('click', function (e) { e.stopPropagation(); moveBlock(block, -1); });
            ctl.querySelector('[data-le-down]').addEventListener('click', function (e) { e.stopPropagation(); moveBlock(block, 1); });
            ctl.querySelector('[data-le-del]').addEventListener('click', function (e) {
                e.stopPropagation();
                if (confirm('Удалить этот блок?')) block.remove();
            });
            block.appendChild(ctl);
        });
    }

    function hbtn() {
        return css({
            width: '24px', height: '24px', border: 'none', borderRadius: '5px',
            background: '#333', color: '#fff', cursor: 'pointer', font: '11px system-ui',
        });
    }

    function moveBlock(block, dir) {
        var blocks = topBlocks();
        var i = blocks.indexOf(block);
        var j = i + dir;
        if (j < 0 || j >= blocks.length) return;
        if (dir < 0) block.parentNode.insertBefore(block, blocks[j]);
        else block.parentNode.insertBefore(block, blocks[j].nextSibling);
        block.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // ── тулбар шрифта и размера для выбранного текста ─────────────────────────
    var FONTS = [
        { label: 'Как есть', value: '' },
        { label: 'Georgia', value: 'Georgia, serif' },
        { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
        { label: 'Times', value: '"Times New Roman", Times, serif' },
        { label: 'Courier', value: '"Courier New", monospace' },
        { label: 'Roboto', value: 'Roboto, sans-serif', google: 'Roboto:wght@400;700' },
        { label: 'Montserrat', value: 'Montserrat, sans-serif', google: 'Montserrat:wght@400;700' },
        { label: 'Playfair', value: '"Playfair Display", serif', google: 'Playfair+Display:wght@400;700' },
        { label: 'Inter', value: 'Inter, sans-serif', google: 'Inter:wght@400;700' },
    ];
    var fontTarget = null;

    function buildFontBar() {
        var box = el('div', {
            id: '__le_fontbar',
            style: css({
                position: 'fixed', left: '50%', bottom: '18px', transform: 'translateX(-50%)',
                zIndex: 2147483001, display: 'none', gap: '6px', alignItems: 'center',
                padding: '8px 12px', background: '#111', color: '#fff', borderRadius: '10px',
                font: '13px system-ui, sans-serif', boxShadow: '0 6px 20px rgba(0,0,0,.35)',
            }),
        });
        var opts = FONTS.map(function (f, i) { return '<option value="' + i + '">' + f.label + '</option>'; }).join('');
        box.innerHTML =
            '<span style="opacity:.6">Шрифт</span>' +
            '<select data-le-font style="padding:5px;border-radius:6px;border:none">' + opts + '</select>' +
            '<button data-le-fdown style="' + hbtn() + '">A−</button>' +
            '<button data-le-fup style="' + hbtn() + '">A+</button>' +
            '<button data-le-bold style="' + hbtn() + ';font-weight:700">Ж</button>';
        document.body.appendChild(box);

        box.querySelector('[data-le-font]').addEventListener('change', function () {
            var t = target();
            if (!t) return;
            var f = FONTS[Number(this.value)];
            if (f.google) ensureGoogleFont(f.google);
            t.style.fontFamily = f.value;
        });
        box.querySelector('[data-le-fup]').addEventListener('click', function () { bumpSize(1); });
        box.querySelector('[data-le-fdown]').addEventListener('click', function () { bumpSize(-1); });
        box.querySelector('[data-le-bold]').addEventListener('click', function () {
            var t = target();
            if (!t) return;
            var cur = getComputedStyle(t).fontWeight;
            t.style.fontWeight = (Number(cur) >= 600 || cur === 'bold') ? '400' : '700';
        });

        // Тулбар виден весь режим правки. Цель — последний текст, куда ставили
        // курсор; на программный focus не полагаемся (в части движков focusin
        // при нём не всплывает), поэтому цель ещё и вычисляется по активному
        // элементу и по выделению.
        box.style.display = 'flex';
        document.addEventListener('focusin', function (e) {
            var t = e.target.closest && e.target.closest('[data-le-text]');
            if (t) { fontTarget = t; syncFontSelect(box, t); }
        });
        document.addEventListener('selectionchange', function () {
            var s = document.getSelection();
            var n = s && s.anchorNode ? (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentElement) : null;
            var t = n && n.closest ? n.closest('[data-le-text]') : null;
            if (t) { fontTarget = t; syncFontSelect(box, t); }
        });
    }

    /** Текущая цель шрифта: выбранный текст или активный редактируемый элемент. */
    function target() {
        if (fontTarget && fontTarget.isConnected) return fontTarget;
        var a = document.activeElement;
        if (a && a.matches && a.matches('[data-le-text]')) return a;
        return null;
    }

    function syncFontSelect(box, t) {
        var fam = (t.style.fontFamily || '').toLowerCase();
        var idx = 0;
        for (var i = 0; i < FONTS.length; i++) {
            if (FONTS[i].value && fam.indexOf(FONTS[i].value.split(',')[0].replace(/["']/g, '').toLowerCase()) >= 0) { idx = i; break; }
        }
        box.querySelector('[data-le-font]').value = String(idx);
    }

    function bumpSize(dir) {
        var t = target();
        if (!t) return;
        var px = parseFloat(getComputedStyle(t).fontSize) || 16;
        t.style.fontSize = Math.max(8, Math.round(px + dir * 2)) + 'px';
    }

    function ensureGoogleFont(spec) {
        var id = '__le_gf_' + spec.replace(/[^a-z0-9]/gi, '');
        if (document.getElementById(id)) return;
        var link = el('link', { id: id, rel: 'stylesheet', 'data-le-font-link': '1' });
        link.href = 'https://fonts.googleapis.com/css2?family=' + spec + '&display=swap';
        document.head.appendChild(link);
    }

    function hasBlockChild(node) {
        return Array.prototype.some.call(node.children, function (c) {
            var d = getComputedStyle(c).display;
            return d === 'block' || d === 'flex' || d === 'grid' || TEXT_TAGS.indexOf(c.tagName) >= 0;
        });
    }

    // ── картинки: загрузка файла или генерация нейросетью ─────────────────────
    var activeImg = null;

    function onImageClick(e) {
        e.preventDefault();
        e.stopPropagation();
        activeImg = e.currentTarget;
        openImageMenu();
    }

    function openImageMenu() {
        closeImageMenu();
        var menu = el('div', {
            id: '__le_imgmenu',
            style: css({
                position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 2147483001, background: '#fff', color: '#111', borderRadius: '12px',
                padding: '18px', width: '320px', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
                font: '14px system-ui, sans-serif',
            }),
        });
        menu.innerHTML =
            '<div style="font-weight:600;margin-bottom:12px">Заменить картинку</div>' +
            '<button id="__le_upload" style="width:100%;padding:10px;margin-bottom:8px;border:1px solid #ddd;border-radius:8px;background:#f7f7f8;cursor:pointer">Загрузить файл</button>' +
            '<div style="display:flex;gap:6px;margin-bottom:8px">' +
            '<input id="__le_prompt" placeholder="Опишите картинку…" style="flex:1;padding:9px;border:1px solid #ddd;border-radius:8px"/>' +
            '<button id="__le_gen" style="padding:9px 12px;border:none;border-radius:8px;background:#7c3aed;color:#fff;cursor:pointer">ИИ</button>' +
            '</div>' +
            '<button id="__le_imgclose" style="width:100%;padding:8px;border:none;background:transparent;color:#888;cursor:pointer">Отмена</button>' +
            '<div id="__le_imgstatus" style="margin-top:8px;color:#7c3aed;min-height:16px"></div>';
        document.body.appendChild(menu);

        var fileInput = el('input', { type: 'file', accept: 'image/*', style: 'display:none' });
        document.body.appendChild(fileInput);

        menu.querySelector('#__le_upload').addEventListener('click', function () { fileInput.click(); });
        fileInput.addEventListener('change', function () {
            var f = fileInput.files && fileInput.files[0];
            if (!f) return;
            var fr = new FileReader();
            fr.onload = function () {
                if (activeImg) activeImg.src = String(fr.result);
                closeImageMenu();
            };
            fr.readAsDataURL(f);
        });

        menu.querySelector('#__le_gen').addEventListener('click', function () {
            var prompt = menu.querySelector('#__le_prompt').value.trim();
            if (!prompt) return;
            var st = menu.querySelector('#__le_imgstatus');
            st.textContent = 'Рисую…';
            fetch(GEN_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userPrompt: prompt }),
            })
                .then(function (r) { return r.json(); })
                .then(function (d) {
                    if (d && d.ok && d.data && d.data.imageUrl) {
                        if (activeImg) activeImg.src = d.data.imageUrl;
                        closeImageMenu();
                    } else st.textContent = (d && d.error) || 'Не получилось';
                })
                .catch(function () { st.textContent = 'Нет связи с сервером'; });
        });

        menu.querySelector('#__le_imgclose').addEventListener('click', closeImageMenu);
    }

    function closeImageMenu() {
        var m = document.getElementById('__le_imgmenu');
        if (m) m.remove();
    }

    // ── панель сверху: сохранить / отмена ─────────────────────────────────────
    function buildBar() {
        var bar = el('div', {
            id: '__le_bar',
            style: css({
                position: 'fixed', left: 0, top: 0, right: 0, zIndex: 2147483002,
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '10px 16px', background: '#111', color: '#fff',
                font: '14px system-ui, sans-serif', boxShadow: '0 2px 10px rgba(0,0,0,.3)',
            }),
        });
        bar.innerHTML =
            '<span style="font-weight:600">Редактирование лендинга</span>' +
            '<span style="opacity:.6;font-size:12px">Текст правится на месте, по картинке — клик</span>' +
            '<span style="flex:1"></span>' +
            '<span id="__le_status" style="color:#a78bfa"></span>' +
            '<button id="__le_save" style="padding:8px 18px;border:none;border-radius:8px;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer">Сохранить</button>' +
            '<button id="__le_cancel" style="padding:8px 14px;border:1px solid #444;border-radius:8px;background:transparent;color:#fff;cursor:pointer">Выйти</button>';
        document.body.appendChild(bar);
        document.body.style.paddingTop = bar.offsetHeight + 'px';

        bar.querySelector('#__le_save').addEventListener('click', save);
        bar.querySelector('#__le_cancel').addEventListener('click', function () { location.reload(); });
    }

    // ── сохранение ────────────────────────────────────────────────────────────
    function save() {
        var status = document.getElementById('__le_status');
        status.textContent = 'Сохраняю…';
        var html = serialize();
        fetch(SAVE_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, path: slug, password: sessionStorage.getItem('__le_pw') || '', html: html }),
        })
            .then(function (r) { return r.json(); })
            .then(function (d) {
                if (d && d.ok) { status.textContent = 'Сохранено'; setTimeout(function () { location.reload(); }, 700); }
                else status.textContent = (d && d.error) || 'Ошибка сохранения';
            })
            .catch(function () { status.textContent = 'Нет связи с сервером'; });
    }

    /** Чистый HTML документа без редакторской обвязки. */
    function serialize() {
        var doc = document.documentElement.cloneNode(true);

        // снять весь редакторский интерфейс из копии
        doc.querySelectorAll('#__le_bar, #__le_launch, #__le_imgmenu, #__le_fontbar').forEach(function (n) { n.remove(); });
        doc.querySelectorAll('[data-le-handle]').forEach(function (n) { n.remove(); });

        doc.querySelectorAll('[data-le-text]').forEach(function (n) {
            n.removeAttribute('contenteditable');
            n.removeAttribute('data-le-text');
            n.style.outline = '';
            n.style.outlineOffset = '';
            // fontFamily/fontSize/fontWeight — это правки пользователя, их оставляем
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        doc.querySelectorAll('[data-le-img]').forEach(function (n) {
            n.removeAttribute('data-le-img');
            n.style.cursor = '';
            n.style.outline = '';
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        // вернуть блокам исходный position (мы ставили relative ради хэндлов)
        doc.querySelectorAll('[data-le-pos]').forEach(function (n) {
            n.style.position = n.getAttribute('data-le-pos') || '';
            n.removeAttribute('data-le-pos');
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        // убрать наш padding-top с body
        var b = doc.querySelector('body');
        if (b) { b.style.paddingTop = ''; if (!b.getAttribute('style')) b.removeAttribute('style'); }
        // выкинуть сам тег редактора, чтобы он не задвоился
        doc.querySelectorAll('script[src="/landing-editor.js"]').forEach(function (n) { n.remove(); });
        // Google-шрифты, подключённые при выборе, ОСТАВЛЯЕМ — иначе выбранный
        // шрифт не отобразится на сохранённой странице. Снимаем только служебный
        // маркер, по которому их находили.
        doc.querySelectorAll('[data-le-font-link]').forEach(function (n) { n.removeAttribute('data-le-font-link'); });

        return '<!DOCTYPE html>\n' + doc.outerHTML;
    }

    // ── мелкие помощники ──────────────────────────────────────────────────────
    function el(tag, props) {
        var node = document.createElement(tag);
        Object.keys(props || {}).forEach(function (k) {
            if (k === 'style' || k === 'textContent' || k === 'type' || k === 'accept') node[k] = props[k];
            else node.setAttribute(k, props[k]);
        });
        return node;
    }
    function css(obj) {
        return Object.keys(obj).map(function (k) {
            return k.replace(/[A-Z]/g, function (m) { return '-' + m.toLowerCase(); }) + ':' + obj[k];
        }).join(';');
    }
})();
