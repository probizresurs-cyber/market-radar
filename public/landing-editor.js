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

    // currentScript равен null, когда тег помечен defer (скрипт выполняется
    // после парсинга) — поэтому находим свой тег и запасным путём, по src.
    var script = document.currentScript || document.querySelector('script[src*="landing-editor"]');
    // id — что правим: slug лендинга market-radar или путь статической страницы
    // Mida. save/generate — куда слать; по умолчанию — API market-radar, чтобы
    // на лендингах /l/[slug] всё работало без атрибутов.
    var SAVE_URL = (script && script.dataset.save) || '/api/landing-edit-save';
    var GEN_URL = (script && script.dataset.generate) || '/api/generate-image-anthropic';
    // id — что правим. Для лендингов market-radar его передают явно (data-slug).
    // Для статических сайтов Mida надёжнее взять адрес самой страницы на клиенте,
    // чем из сборки (там путь искажается окружением) — по нему сервер найдёт файл.
    var slug = (script && (script.dataset.slug || script.dataset.id)) ||
        (script && script.dataset.save ? location.pathname : '');
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
        markSelectable();
        markSections();  // перемещение блоков вверх/вниз, дублирование, добавление
        buildFontBar();  // шрифт, размер, цвет для выбранного текста
        buildSelectionUI(); // рамка выделения с ручками + панель элемента
    }

    // Помечаем то, что можно выделять и свободно двигать: листовые тексты,
    // картинки, кнопки/ссылки. Клик выделяет (рамка + ручки), двойной клик по
    // тексту — правка на месте.
    function markSelectable() {
        var sel = TEXT_TAGS.join(',') + ',img';
        document.querySelectorAll(sel).forEach(function (node) {
            if (node.closest('#__le_bar') || node.closest('#__le_fontbar')) return;
            if (node.tagName !== 'IMG' && hasBlockChild(node)) return;
            node.setAttribute('data-le-el', '1');
            if (node.tagName === 'IMG') node.setAttribute('data-le-img', '1');
            else node.setAttribute('data-le-text', '1');
        });

        // Один обработчик на документ — надёжнее сотен на элементах и переживает
        // добавление новых блоков.
        if (!document.__leClickBound) {
            document.__leClickBound = true;
            document.addEventListener('mousedown', onDocMouseDown, true);
            document.addEventListener('dblclick', onDocDblClick, true);
        }
    }

    function onDocMouseDown(e) {
        if (e.target.closest('#__le_bar, #__le_fontbar, #__le_imgmenu, #__le_addmenu, #__le_elpanel, [data-le-handle], [data-le-sel]')) return;
        var elx = e.target.closest('[data-le-el]');
        if (elx) {
            // Если элемент уже правится текстом — не мешаем печатать.
            if (elx.getAttribute('contenteditable') === 'true') return;
            e.preventDefault();
            selectEl(elx);
            startElDrag(elx, e);
        } else {
            deselect();
        }
    }

    function onDocDblClick(e) {
        var img = e.target.closest('[data-le-img]');
        if (img) { e.preventDefault(); activeImg = img; openImageMenu(); return; }
        var t = e.target.closest('[data-le-text]');
        if (!t) return;
        t.setAttribute('contenteditable', 'true');
        t.focus();
        var off = function () {
            t.removeAttribute('contenteditable');
            t.removeEventListener('blur', off);
        };
        t.addEventListener('blur', off);
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
        topBlocks().forEach(decorateBlock);
    }

    function decorateBlock(block) {
        if (block.querySelector(':scope > [data-le-handle]')) return; // уже размечен
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
            '<button title="Перетащить" data-le-drag style="' + hbtn() + ';cursor:grab">✥</button>' +
            '<button title="Выше" data-le-up style="' + hbtn() + '">▲</button>' +
            '<button title="Ниже" data-le-down style="' + hbtn() + '">▼</button>' +
            '<button title="Дублировать" data-le-dup style="' + hbtn() + '">⧉</button>' +
            '<button title="Фон блока" data-le-bg style="' + hbtn() + '">🎨</button>' +
            '<button title="Добавить блок ниже" data-le-add style="' + hbtn() + '">＋</button>' +
            '<button title="Удалить блок" data-le-del style="' + hbtn() + '">✕</button>';

        ctl.querySelector('[data-le-up]').addEventListener('click', function (e) { e.stopPropagation(); snapshot(); moveBlock(block, -1); });
        ctl.querySelector('[data-le-down]').addEventListener('click', function (e) { e.stopPropagation(); snapshot(); moveBlock(block, 1); });
        ctl.querySelector('[data-le-dup]').addEventListener('click', function (e) {
            e.stopPropagation(); snapshot();
            var copy = cleanBlock(block);
            block.parentNode.insertBefore(copy, block.nextSibling);
            decorateBlock(copy);
            copy.scrollIntoView({ block: 'center', behavior: 'smooth' });
        });
        ctl.querySelector('[data-le-bg]').addEventListener('click', function (e) {
            e.stopPropagation();
            var input = el('input', { type: 'color' });
            input.value = rgbToHex(getComputedStyle(block).backgroundColor);
            input.addEventListener('input', function () { snapshot(); block.style.backgroundColor = input.value; });
            input.click();
        });
        ctl.querySelector('[data-le-add]').addEventListener('click', function (e) { e.stopPropagation(); openAddMenu(block); });
        ctl.querySelector('[data-le-del]').addEventListener('click', function (e) {
            e.stopPropagation();
            if (confirm('Удалить этот блок?')) { snapshot(); block.remove(); }
        });

        // Перетаскивание мышью за ручку ✥.
        var grip = ctl.querySelector('[data-le-drag]');
        grip.addEventListener('mousedown', function (e) { e.stopPropagation(); startDrag(block, e); });

        block.appendChild(ctl);
    }

    /** Копия блока без редакторской обвязки — чтобы не дублировать хэндлы. */
    function cleanBlock(block) {
        var copy = block.cloneNode(true);
        copy.querySelectorAll('[data-le-handle]').forEach(function (n) { n.remove(); });
        copy.removeAttribute('data-le-pos');
        return copy;
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

    // ── перетаскивание блока мышью ────────────────────────────────────────────
    function startDrag(block, downEvent) {
        downEvent.preventDefault();
        snapshot();
        var marker = el('div', {
            'data-le-drop': '1',
            style: css({ height: '4px', background: '#7c3aed', margin: '0', borderRadius: '2px' }),
        });
        block.style.opacity = '0.5';

        function onMove(e) {
            var blocks = topBlocks().filter(function (b) { return b !== block; });
            var target = null;
            for (var i = 0; i < blocks.length; i++) {
                var r = blocks[i].getBoundingClientRect();
                if (e.clientY < r.top + r.height / 2) { target = blocks[i]; break; }
            }
            if (target) target.parentNode.insertBefore(marker, target);
            else document.body.appendChild(marker);
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (marker.parentNode) marker.parentNode.insertBefore(block, marker);
            marker.remove();
            block.style.opacity = '';
            if (!block.getAttribute('style')) block.removeAttribute('style');
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ── добавление нового блока ────────────────────────────────────────────────
    var TEMPLATES = {
        heading: '<section style="padding:48px 24px;text-align:center"><h2 style="font-size:32px;margin:0">Новый заголовок</h2></section>',
        text: '<section style="padding:32px 24px;max-width:720px;margin:0 auto"><p style="font-size:18px;line-height:1.6;margin:0">Новый абзац. Нажмите и напишите свой текст.</p></section>',
        image: '<section style="padding:24px;text-align:center"><img src="https://via.placeholder.com/800x400/eeeeee/999999?text=Картинка" alt="" style="max-width:100%;border-radius:8px"/></section>',
        button: '<section style="padding:40px 24px;text-align:center"><a href="#" style="display:inline-block;padding:14px 32px;background:#7c3aed;color:#fff;border-radius:8px;text-decoration:none;font-weight:600">Кнопка</a></section>',
        divider: '<section style="padding:24px"><hr style="border:none;border-top:1px solid #ddd;margin:0"/></section>',
    };

    function openAddMenu(afterBlock) {
        closeAddMenu();
        var menu = el('div', {
            id: '__le_addmenu',
            style: css({
                position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
                zIndex: 2147483001, background: '#fff', color: '#111', borderRadius: '12px',
                padding: '18px', width: '280px', boxShadow: '0 10px 40px rgba(0,0,0,.3)',
                font: '14px system-ui, sans-serif',
            }),
        });
        menu.innerHTML =
            '<div style="font-weight:600;margin-bottom:12px">Добавить блок</div>' +
            btn('heading', 'Заголовок') + btn('text', 'Абзац текста') + btn('image', 'Картинка') +
            btn('button', 'Кнопка') + btn('divider', 'Разделитель') +
            '<button data-le-addclose style="width:100%;padding:8px;margin-top:6px;border:none;background:transparent;color:#888;cursor:pointer">Отмена</button>';
        document.body.appendChild(menu);

        function btn(kind, label) {
            return '<button data-le-tpl="' + kind + '" style="width:100%;padding:10px;margin-bottom:6px;border:1px solid #ddd;border-radius:8px;background:#f7f7f8;cursor:pointer;text-align:left">' + label + '</button>';
        }
        menu.querySelectorAll('[data-le-tpl]').forEach(function (b) {
            b.addEventListener('click', function () {
                snapshot();
                var tmp = el('div', {});
                tmp.innerHTML = TEMPLATES[b.getAttribute('data-le-tpl')];
                var node = tmp.firstElementChild;
                afterBlock.parentNode.insertBefore(node, afterBlock.nextSibling);
                decorateBlock(node);
                // сделать новый текст сразу редактируемым
                node.querySelectorAll(TEXT_TAGS.join(',')).forEach(function (t) {
                    if (hasBlockChild(t)) return;
                    t.setAttribute('contenteditable', 'true');
                    t.setAttribute('data-le-text', '1');
                });
                node.querySelectorAll('img').forEach(function (img) {
                    img.setAttribute('data-le-img', '1');
                    img.setAttribute('data-le-el', '1');
                });
                node.querySelectorAll(TEXT_TAGS.join(',')).forEach(function (t) {
                    if (!hasBlockChild(t)) t.setAttribute('data-le-el', '1');
                });
                closeAddMenu();
                node.scrollIntoView({ block: 'center', behavior: 'smooth' });
            });
        });
        menu.querySelector('[data-le-addclose]').addEventListener('click', closeAddMenu);
    }

    function closeAddMenu() {
        var m = document.getElementById('__le_addmenu');
        if (m) m.remove();
    }

    // ── отмена (снимок перед структурными операциями) ─────────────────────────
    var undoStack = [];

    function snapshot() {
        // Снимаем контентную часть без наших панелей (fixed-элементы с __le id),
        // чтобы восстановление не воскрешало старый интерфейс редактора.
        var blocks = Array.prototype.filter.call(document.body.children, function (n) {
            return !(n.id && n.id.indexOf('__le') === 0);
        });
        undoStack.push(blocks.map(function (b) { return b.outerHTML; }).join(''));
        if (undoStack.length > 40) undoStack.shift();
        updateUndoBtn();
    }

    function undo() {
        if (!undoStack.length) return;
        var html = undoStack.pop();
        // убрать текущие контентные блоки, вернуть из снимка
        Array.prototype.slice.call(document.body.children).forEach(function (n) {
            if (!(n.id && n.id.indexOf('__le') === 0)) n.remove();
        });
        var bar = document.getElementById('__le_bar');
        var tmp = el('div', {});
        tmp.innerHTML = html;
        while (tmp.firstChild) document.body.insertBefore(tmp.firstChild, bar ? bar.nextSibling : null);
        redecorate();
        updateUndoBtn();
    }

    /** Заново навесить редактирование после восстановления из снимка. */
    function redecorate() {
        deselect();
        document.querySelectorAll('[data-le-handle]').forEach(function (n) { n.remove(); });
        markSelectable();
        markSections();
    }

    function updateUndoBtn() {
        var u = document.getElementById('__le_undo');
        if (u) u.disabled = undoStack.length === 0;
    }

    function rgbToHex(rgb) {
        var m = String(rgb).match(/\d+/g);
        if (!m || m.length < 3) return '#ffffff';
        return '#' + m.slice(0, 3).map(function (x) { return ('0' + Number(x).toString(16)).slice(-2); }).join('');
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
            '<button data-le-bold style="' + hbtn() + ';font-weight:700">Ж</button>' +
            '<label title="Цвет текста" style="' + hbtn() + ';display:inline-flex;align-items:center;justify-content:center;overflow:hidden;position:relative">A<input data-le-color type="color" style="position:absolute;inset:0;opacity:0;cursor:pointer"/></label>';
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
        box.querySelector('[data-le-color]').addEventListener('input', function () {
            var t = target();
            if (t) t.style.color = this.value;
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

    // ── свободное позиционирование (Tilda Zero: absolute внутри блока-канвы) ──
    var selected = null;
    var selBox = null; // рамка выделения (fixed overlay)
    var elPanel = null; // панель действий над выбранным элементом

    /** Ближайшая секция-родитель, которая станет канвой для absolute-детей. */
    function canvasOf(elx) {
        var b = elx.parentElement;
        while (b && b !== document.body && topBlocks().indexOf(b) === -1) b = b.parentElement;
        return b && b !== document.body ? b : elx.parentElement;
    }

    /** Переводит элемент в свободное позиционирование, не роняя высоту блока. */
    function makeFree(elx) {
        if (elx.getAttribute('data-le-free') === '1') return;
        var canvas = canvasOf(elx);
        // Канва фиксирует свою высоту, чтобы absolute-дети не схлопнули её.
        if (getComputedStyle(canvas).position === 'static') {
            canvas.setAttribute('data-le-pos', canvas.style.position || '');
            canvas.style.position = 'relative';
        }
        if (!canvas.getAttribute('data-le-minh')) {
            canvas.setAttribute('data-le-minh', canvas.style.minHeight || '');
            canvas.style.minHeight = canvas.getBoundingClientRect().height + 'px';
        }
        var r = elx.getBoundingClientRect();
        var cr = canvas.getBoundingClientRect();
        elx.setAttribute('data-le-free', '1');
        elx.style.position = 'absolute';
        elx.style.left = Math.round(r.left - cr.left) + 'px';
        elx.style.top = Math.round(r.top - cr.top) + 'px';
        elx.style.width = Math.round(r.width) + 'px';
        elx.style.margin = '0';
        if (!elx.style.zIndex) elx.style.zIndex = '1';
    }

    function selectEl(elx) {
        if (selected === elx) return;
        deselect();
        selected = elx;
        positionSelBox();
        showElPanel();
    }

    function deselect() {
        selected = null;
        if (selBox) selBox.style.display = 'none';
        if (elPanel) elPanel.style.display = 'none';
    }

    function positionSelBox() {
        if (!selected || !selBox) return;
        var r = selected.getBoundingClientRect();
        selBox.style.display = 'block';
        selBox.style.left = r.left + 'px';
        selBox.style.top = r.top + 'px';
        selBox.style.width = r.width + 'px';
        selBox.style.height = r.height + 'px';
    }

    function buildSelectionUI() {
        // Рамка с восемью ручками ресайза — как в конструкторах. Сама рамка
        // событий не ловит (pointer-events:none), ловят только ручки.
        selBox = el('div', {
            'data-le-sel': '1',
            style: css({
                position: 'fixed', zIndex: 2147482500, display: 'none',
                border: '1px solid #7c3aed', boxSizing: 'border-box', pointerEvents: 'none',
            }),
        });
        var dirs = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        dirs.forEach(function (d) {
            var h = el('div', {
                'data-le-rz': d,
                style: css({
                    position: 'absolute', width: '10px', height: '10px', background: '#fff',
                    border: '1px solid #7c3aed', borderRadius: '2px', pointerEvents: 'auto',
                    cursor: d + '-resize', boxSizing: 'border-box',
                }) + ';' + handlePos(d),
            });
            h.addEventListener('mousedown', function (e) { e.stopPropagation(); e.preventDefault(); startResize(selected, d, e); });
            selBox.appendChild(h);
        });
        document.body.appendChild(selBox);

        window.addEventListener('scroll', positionSelBox, true);
        window.addEventListener('resize', positionSelBox);
    }

    function handlePos(d) {
        var m = '-5px';
        var map = {
            nw: 'left:' + m + ';top:' + m, n: 'left:calc(50% - 5px);top:' + m, ne: 'right:' + m + ';top:' + m,
            e: 'right:' + m + ';top:calc(50% - 5px)', se: 'right:' + m + ';bottom:' + m, s: 'left:calc(50% - 5px);bottom:' + m,
            sw: 'left:' + m + ';bottom:' + m, w: 'left:' + m + ';top:calc(50% - 5px)',
        };
        return map[d];
    }

    // ── перетаскивание выбранного элемента ────────────────────────────────────
    function startElDrag(elx, downEvent) {
        var startX = downEvent.clientX, startY = downEvent.clientY;
        var moved = false;

        function onMove(e) {
            var dx = e.clientX - startX, dy = e.clientY - startY;
            if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return; // это клик, не drag
            if (!moved) { moved = true; snapshot(); makeFree(elx); }
            var canvas = canvasOf(elx);
            var cr = canvas.getBoundingClientRect();
            var r = elx.getBoundingClientRect();
            elx.style.left = Math.round(r.left - cr.left + dx) + 'px';
            elx.style.top = Math.round(r.top - cr.top + dy) + 'px';
            startX = e.clientX; startY = e.clientY;
            positionSelBox();
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ── ресайз выбранного элемента ────────────────────────────────────────────
    function startResize(elx, dir, downEvent) {
        snapshot();
        makeFree(elx);
        var sx = downEvent.clientX, sy = downEvent.clientY;
        var r = elx.getBoundingClientRect();
        var canvas = canvasOf(elx);
        var cr = canvas.getBoundingClientRect();
        var x0 = r.left - cr.left, y0 = r.top - cr.top, w0 = r.width, h0 = r.height;

        function onMove(e) {
            var dx = e.clientX - sx, dy = e.clientY - sy;
            var w = w0, h = h0, x = x0, y = y0;
            if (dir.indexOf('e') >= 0) w = Math.max(20, w0 + dx);
            if (dir.indexOf('s') >= 0) h = Math.max(20, h0 + dy);
            if (dir.indexOf('w') >= 0) { w = Math.max(20, w0 - dx); x = x0 + dx; }
            if (dir.indexOf('n') >= 0) { h = Math.max(20, h0 - dy); y = y0 + dy; }
            elx.style.width = Math.round(w) + 'px';
            if (dir.indexOf('n') >= 0 || dir.indexOf('s') >= 0) elx.style.height = Math.round(h) + 'px';
            elx.style.left = Math.round(x) + 'px';
            elx.style.top = Math.round(y) + 'px';
            if (elx.tagName === 'IMG') elx.style.objectFit = 'cover';
            positionSelBox();
        }
        function onUp() {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }

    // ── панель выбранного элемента: слои, выравнивание, удаление ───────────────
    function showElPanel() {
        if (!elPanel) buildElPanel();
        elPanel.style.display = 'flex';
        positionElPanel();
    }
    function positionElPanel() {
        if (!selected || !elPanel) return;
        var r = selected.getBoundingClientRect();
        elPanel.style.left = Math.max(8, r.left) + 'px';
        elPanel.style.top = Math.max(48, r.top - 40) + 'px';
    }
    function buildElPanel() {
        elPanel = el('div', {
            id: '__le_elpanel',
            style: css({
                position: 'fixed', zIndex: 2147483001, display: 'none', gap: '3px',
                padding: '4px', background: '#111', borderRadius: '8px',
                boxShadow: '0 4px 14px rgba(0,0,0,.3)',
            }),
        });
        elPanel.innerHTML =
            '<button title="На передний план" data-le-front style="' + hbtn() + '">⬆слой</button>' +
            '<button title="На задний план" data-le-back style="' + hbtn() + '">⬇слой</button>' +
            '<button title="Влево" data-le-al style="' + hbtn() + '">⌊</button>' +
            '<button title="По центру" data-le-ac style="' + hbtn() + '">↔</button>' +
            '<button title="Вправо" data-le-ar style="' + hbtn() + '">⌋</button>' +
            '<button title="В поток (сбросить свободное)" data-le-flow style="' + hbtn() + '">↺</button>' +
            '<button title="Удалить" data-le-eldel style="' + hbtn() + '">✕</button>';
        document.body.appendChild(elPanel);

        var z = function (dir) {
            if (!selected) return; snapshot(); makeFree(selected);
            var cur = Number(getComputedStyle(selected).zIndex) || 1;
            selected.style.zIndex = String(Math.max(0, cur + dir));
        };
        elPanel.querySelector('[data-le-front]').addEventListener('click', function () { z(1); });
        elPanel.querySelector('[data-le-back]').addEventListener('click', function () { z(-1); });
        var align = function (how) {
            if (!selected) return; snapshot(); makeFree(selected);
            var canvas = canvasOf(selected);
            var cw = canvas.getBoundingClientRect().width;
            var w = selected.getBoundingClientRect().width;
            if (how === 'l') selected.style.left = '0px';
            else if (how === 'c') selected.style.left = Math.round((cw - w) / 2) + 'px';
            else selected.style.left = Math.round(cw - w) + 'px';
            positionSelBox();
        };
        elPanel.querySelector('[data-le-al]').addEventListener('click', function () { align('l'); });
        elPanel.querySelector('[data-le-ac]').addEventListener('click', function () { align('c'); });
        elPanel.querySelector('[data-le-ar]').addEventListener('click', function () { align('r'); });
        elPanel.querySelector('[data-le-flow]').addEventListener('click', function () {
            if (!selected) return; snapshot();
            ['position', 'left', 'top', 'width', 'height', 'margin', 'zIndex', 'objectFit'].forEach(function (p) { selected.style[p] = ''; });
            selected.removeAttribute('data-le-free');
            if (!selected.getAttribute('style')) selected.removeAttribute('style');
            deselect();
        });
        elPanel.querySelector('[data-le-eldel]').addEventListener('click', function () {
            if (!selected) return; snapshot();
            var s = selected; deselect(); s.remove();
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
            '<span style="font-weight:600">Редактирование</span>' +
            '<span style="opacity:.6;font-size:12px">Текст — на месте · картинка — клик · блок — ручки в углу</span>' +
            '<span style="flex:1"></span>' +
            '<span id="__le_status" style="color:#a78bfa"></span>' +
            '<button id="__le_undo" title="Отменить (Ctrl+Z)" disabled style="padding:8px 12px;border:1px solid #444;border-radius:8px;background:transparent;color:#fff;cursor:pointer">↶ Отменить</button>' +
            '<button id="__le_save" style="padding:8px 18px;border:none;border-radius:8px;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer">Сохранить</button>' +
            '<button id="__le_cancel" style="padding:8px 14px;border:1px solid #444;border-radius:8px;background:transparent;color:#fff;cursor:pointer">Выйти</button>';
        document.body.appendChild(bar);
        document.body.style.paddingTop = bar.offsetHeight + 'px';

        bar.querySelector('#__le_undo').addEventListener('click', undo);
        bar.querySelector('#__le_save').addEventListener('click', save);
        bar.querySelector('#__le_cancel').addEventListener('click', function () { location.reload(); });

        // Ctrl+Z — отмена последнего структурного действия.
        document.addEventListener('keydown', function (e) {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.target.closest('[data-le-text]')) {
                e.preventDefault();
                undo();
            }
        });
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
        doc.querySelectorAll('#__le_bar, #__le_launch, #__le_imgmenu, #__le_fontbar, #__le_addmenu, #__le_elpanel').forEach(function (n) { n.remove(); });
        doc.querySelectorAll('[data-le-handle], [data-le-drop], [data-le-sel]').forEach(function (n) { n.remove(); });

        doc.querySelectorAll('[data-le-text]').forEach(function (n) {
            n.removeAttribute('contenteditable');
            n.removeAttribute('data-le-text');
            n.style.outline = '';
            n.style.outlineOffset = '';
            // шрифт, цвет, свободные координаты — это правки пользователя, оставляем
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        doc.querySelectorAll('[data-le-img]').forEach(function (n) {
            n.removeAttribute('data-le-img');
            n.style.cursor = '';
            n.style.outline = '';
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        doc.querySelectorAll('[data-le-el]').forEach(function (n) { n.removeAttribute('data-le-el'); });
        doc.querySelectorAll('[data-le-free]').forEach(function (n) { n.removeAttribute('data-le-free'); });

        // position/min-height канвы: если внутри остались свободно позиционированные
        // элементы (absolute), relative и min-height НУЖНО сохранить — иначе они
        // слетят. Если free-детей нет, возвращаем исходное значение.
        doc.querySelectorAll('[data-le-pos]').forEach(function (n) {
            var hasFree = n.querySelector('[style*="position: absolute"], [style*="position:absolute"]');
            if (!hasFree) n.style.position = n.getAttribute('data-le-pos') || '';
            n.removeAttribute('data-le-pos');
            if (!n.getAttribute('style')) n.removeAttribute('style');
        });
        doc.querySelectorAll('[data-le-minh]').forEach(function (n) {
            var hasFree = n.querySelector('[style*="position: absolute"], [style*="position:absolute"]');
            if (!hasFree) n.style.minHeight = n.getAttribute('data-le-minh') || '';
            n.removeAttribute('data-le-minh');
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
