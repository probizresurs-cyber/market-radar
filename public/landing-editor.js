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
    var slug = (script && script.dataset.slug) || '';
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
        fetch('/api/landing-edit-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, password: pw, check: true }),
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
            fetch('/api/generate-image-anthropic', {
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
        fetch('/api/landing-edit-save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slug: slug, password: sessionStorage.getItem('__le_pw') || '', html: html }),
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

        // снять всё редакторское из копии
        doc.querySelectorAll('#__le_bar, #__le_launch, #__le_imgmenu').forEach(function (n) { n.remove(); });
        doc.querySelectorAll('[data-le-text]').forEach(function (n) {
            n.removeAttribute('contenteditable');
            n.removeAttribute('data-le-text');
            n.style.outline = '';
            n.style.outlineOffset = '';
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        doc.querySelectorAll('[data-le-img]').forEach(function (n) {
            n.removeAttribute('data-le-img');
            n.style.cursor = '';
            n.style.outline = '';
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        // убрать наш padding-top с body
        var b = doc.querySelector('body');
        if (b) { b.style.paddingTop = ''; if (!b.getAttribute('style')) b.removeAttribute('style'); }
        // выкинуть сам тег редактора, чтобы он не задвоился
        doc.querySelectorAll('script[src="/landing-editor.js"]').forEach(function (n) { n.remove(); });

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
