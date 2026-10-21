/*
 * TRPG 세션 툴 — Roll20 캐릭터 내보내기 (Roll20 Pro Mod Script)
 *
 * Roll20 캠페인 설정 → Mod (API) Scripts → New Script 에 통째로 붙여넣고 저장.
 *
 * 쓰는 법 (채팅에 입력, GM만):
 *   !vtt-export                 선택한 토큰의 캐릭터를 내보낸다 (여러 개 선택 가능)
 *   !vtt-export 캐릭터 이름      이름으로 찾아 내보낸다
 *
 * 결과는 핸드아웃 「VTT 내보내기 · 이름」에 JSON 으로 저장된다.
 * 핸드아웃을 열어 JSON 을 통째로 복사해서 세션 툴에 붙여넣으면 된다.
 *
 * 시트 양식을 몰라도 되게, 모든 속성(attribute)·반복 항목(repeating)·능력(ability 매크로)을 그대로 담는다.
 */
var VttCharacterExport =
  VttCharacterExport ||
  (function () {
    "use strict";

    var VERSION = "0.1.0";

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function whisper(who, text) {
      sendChat("VTT 내보내기", '/w "' + who.replace(/ \(GM\)$/, "") + '" ' + text, null, { noarchive: true });
    }

    // repeating_skills_-MXgb6hT9ZsK3n1fQ0aB_name → { section: "skills", row: "-MXgb6hT9ZsK3n1fQ0aB", field: "name" }
    // Roll20 행 ID 는 '-' 포함 20자
    function splitRepeating(name) {
      var m = name.match(/^repeating_([^_]+)_(-[A-Za-z0-9_-]{19})_(.+)$/);
      return m ? { section: m[1], row: m[2], field: m[3] } : null;
    }

    function collect(character) {
      var id = character.id;
      var out = {
        format: "roll20-character-export",
        version: VERSION,
        exportedAt: new Date().toISOString(),
        name: character.get("name"),
        avatar: character.get("avatar") || "",
        attributes: {},
        repeating: {},
        abilities: [],
      };

      findObjs({ _type: "attribute", _characterid: id }).forEach(function (a) {
        var name = a.get("name");
        var cur = a.get("current");
        var max = a.get("max");
        var rep = splitRepeating(name);
        var value = max !== "" && max !== undefined ? { current: cur, max: max } : cur;
        if (rep) {
          out.repeating[rep.section] = out.repeating[rep.section] || {};
          out.repeating[rep.section][rep.row] = out.repeating[rep.section][rep.row] || {};
          out.repeating[rep.section][rep.row][rep.field] = value;
        } else {
          out.attributes[name] = value;
        }
      });

      findObjs({ _type: "ability", _characterid: id }).forEach(function (ab) {
        out.abilities.push({ name: ab.get("name"), action: ab.get("action"), isTokenAction: !!ab.get("istokenaction") });
      });

      // 반복 항목을 행 목록으로 정리
      Object.keys(out.repeating).forEach(function (section) {
        var rows = out.repeating[section];
        out.repeating[section] = Object.keys(rows).map(function (rowId) {
          var r = rows[rowId];
          r._row = rowId;
          return r;
        });
      });
      return out;
    }

    function writeHandout(data, who) {
      var title = "VTT 내보내기 · " + data.name;
      var handout = findObjs({ _type: "handout", name: title })[0];
      if (!handout) handout = createObj("handout", { name: title, inplayerjournals: "", archived: false });
      var json = JSON.stringify(data, null, 2);
      handout.set("notes", "<pre>" + esc(json) + "</pre>");
      whisper(
        who,
        "<b>" + esc(data.name) + "</b> 내보냄 — 속성 " + Object.keys(data.attributes).length +
          "개, 반복 " + Object.keys(data.repeating).length + "종, 매크로 " + data.abilities.length +
          "개. 핸드아웃 「" + esc(title) + "」을 열어 JSON을 복사하세요.",
      );
    }

    function handle(msg) {
      if (msg.type !== "api" || msg.content.indexOf("!vtt-export") !== 0) return;
      if (!playerIsGM(msg.playerid)) return whisper(msg.who, "GM만 쓸 수 있어요.");

      var arg = msg.content.replace(/^!vtt-export\s*/, "").trim();
      var chars = [];
      if (arg) {
        chars = findObjs({ _type: "character", name: arg });
      } else if (msg.selected) {
        msg.selected.forEach(function (s) {
          var g = getObj("graphic", s._id);
          var c = g && g.get("represents") && getObj("character", g.get("represents"));
          if (c) chars.push(c);
        });
      }
      if (!chars.length) return whisper(msg.who, "캐릭터를 찾지 못했어요. 토큰을 선택하거나 <code>!vtt-export 이름</code> 으로 쓰세요.");
      chars.forEach(function (c) {
        writeHandout(collect(c), msg.who);
      });
    }

    on("ready", function () {
      on("chat:message", handle);
      log("VttCharacterExport " + VERSION + " ready");
    });

    return { collect: collect };
  })();
