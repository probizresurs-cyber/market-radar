/**
 * Получение HTML/скриншота сгенерированного экрана Stitch.
 *
 * Зачем отдельный модуль, а не прямой вызов screen.getHtml():
 *
 * SDK-шный Screen.getHtml() устроен так (dist/generated/src/screen.js):
 *   1) если в ответе генерации уже лежит htmlCode.downloadUrl — вернуть его;
 *   2) иначе позвать инструмент get_screen.
 *
 * Второй путь ломается. По манифесту инструментов get_screen требует ТРИ поля:
 *   required: ["name", "projectId", "screenId"]
 * а screenId SDK берёт из `data.id` (или парсит из `data.name`). Если ответ
 * generate_screen_from_text пришёл без идентификатора, screenId становится
 * undefined, SDK всё равно шлёт запрос с `projects/<id>/screens/undefined`,
 * и Stitch отвечает ровно тем, что мы ловили в проде:
 *   «Tool Call Failed [get_screen]: Request contains an invalid argument»
 *
 * Ошибка была немой: ни какой экран, ни был ли вообще id — понять нельзя, и
 * я потратил заметное время, гоняясь за ложной версией про кириллицу
 * (латинская генерация «работала» лишь потому, что downloadUrl приезжал
 * сразу и второй путь не задействовался).
 *
 * Плюс SDK достаёт экран по ЖЁСТКО ЗАШИТОМУ индексу outputComponents[1] —
 * если Stitch вернёт компоненты в другом порядке, экран будет неполным.
 *
 * Здесь всё это обходится: сначала inline-URL, при их отсутствии —
 * восстановление экрана через list_screens (он отдаёт экраны с id), затем
 * несколько попыток с паузой (генерация бывает ещё не дорисована). Наружу
 * уходит либо готовая пара URL, либо ВНЯТНАЯ причина с диагностикой.
 */

/** Минимальная форма Screen из SDK — нам нужны только эти поля. */
interface ScreenLike {
  id: string;
  data?: {
    htmlCode?: { downloadUrl?: string };
    screenshot?: { downloadUrl?: string };
  };
  getHtml(): Promise<string>;
  getImage(): Promise<string>;
}

/** Минимальная форма Project из SDK. */
interface ProjectLike {
  screens(): Promise<ScreenLike[]>;
}

export interface ScreenUrls {
  htmlUrl: string;
  imageUrl: string;
  /**
   * Id экрана, который реально сработал. Возвращаем отдельно, потому что при
   * восстановлении через list_screens он отличается от того, что пришёл из
   * generate — а именно этот id уходит в БД и потом в edit-landing.
   */
  screenId: string;
  /** Как именно добыли ссылки — попадает в лог, помогает разбирать инциденты. */
  via: "inline" | "get_screen" | "list_screens";
  /** Сколько попыток потребовалось (1 = с первого раза). */
  attempts: number;
}

export type ResolveScreenResult =
  | { ok: true; urls: ScreenUrls }
  | { ok: false; error: string; diag: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function inlineUrls(screen: ScreenLike | undefined): { html: string; image: string } {
  return {
    html: screen?.data?.htmlCode?.downloadUrl ?? "",
    image: screen?.data?.screenshot?.downloadUrl ?? "",
  };
}

/**
 * Достаёт htmlUrl/imageUrl экрана максимально живучим способом.
 *
 * @param project  проект Stitch (нужен для list_screens-восстановления)
 * @param screen   экран, полученный из generate/edit/variants
 * @param attempts сколько раз пробовать (генерация бывает не готова сразу)
 */
export async function resolveScreenUrls(
  project: ProjectLike,
  screen: ScreenLike,
  attempts = 3,
): Promise<ResolveScreenResult> {
  // ── 1. Ссылки уже есть в ответе генерации — самый частый и быстрый путь.
  const inline = inlineUrls(screen);
  if (inline.html) {
    return {
      ok: true,
      urls: {
        htmlUrl: inline.html,
        imageUrl: inline.image,
        screenId: screen.id,
        via: "inline",
        attempts: 1,
      },
    };
  }

  let target: ScreenLike = screen;
  let via: ScreenUrls["via"] = "get_screen";
  const problems: string[] = [];

  // ── 2. Нет id — звать get_screen бессмысленно (именно так и рождался
  // «invalid argument»). Восстанавливаем экран через list_screens.
  if (!target.id) {
    problems.push("generate вернул экран без id");
    try {
      const all = await project.screens();
      const recovered = all[all.length - 1];
      if (recovered?.id) {
        target = recovered;
        via = "list_screens";
        const rec = inlineUrls(recovered);
        if (rec.html) {
          return {
            ok: true,
            urls: {
              htmlUrl: rec.html,
              imageUrl: rec.image,
              screenId: recovered.id,
              via: "list_screens",
              attempts: 1,
            },
          };
        }
      } else {
        problems.push("list_screens не вернул ни одного экрана с id");
      }
    } catch (e) {
      problems.push(`list_screens упал: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  if (!target.id) {
    return {
      ok: false,
      error:
        "Stitch не вернул идентификатор сгенерированного экрана — генерация не состоялась. " +
        "Попробуйте запустить ещё раз.",
      diag: problems.join("; "),
    };
  }

  // ── 3. Тянем через get_screen с повторами: сразу после generate экран
  // может быть ещё не дорисован, и первая попытка вернёт пусто.
  for (let i = 1; i <= attempts; i++) {
    try {
      const [htmlUrl, imageUrl] = await Promise.all([target.getHtml(), target.getImage()]);
      if (htmlUrl && htmlUrl.trim()) {
        return {
          ok: true,
          urls: { htmlUrl, imageUrl: imageUrl ?? "", screenId: target.id, via, attempts: i },
        };
      }
      problems.push(`попытка ${i}: get_screen вернул пустой htmlUrl`);
    } catch (e) {
      problems.push(`попытка ${i}: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (i < attempts) await sleep(2000 * i);
  }

  return {
    ok: false,
    error:
      "Stitch сгенерировал экран, но не отдал HTML-страницу. Обычно это значит, что на " +
      "аккаунте Stitch исчерпан план/квота на экспорт HTML — проверьте аккаунт и ключ " +
      "GOOGLE_STITCH_API_KEY.",
    diag: problems.join("; "),
  };
}
