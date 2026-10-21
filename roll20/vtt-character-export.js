/*
 * TRPG 세션 툴 — Roll20 캐릭터 내보내기 (Roll20 Pro Mod Script)
 *
 * Roll20 캠페인 설정 → Mod (API) Scripts → New Script 에 통째로 붙여넣고 저장.
 *
 * 쓰는 법 (채팅에 입력, GM만):
 *   !vtt-export                 선택한 토큰의 캐릭터 (여러 개 선택 가능)
 *   !vtt-export 캐릭터 이름      이름으로 찾아서
 *   !vtt-export all             캠페인의 모든 캐릭터
 *   !vtt-export all pc          PC 시트만      ·  !vtt-export all enemy   에너미 시트만
 *   !vtt-export ping            작동 확인
 *
 * 결과는 핸드아웃 「VTT 내보내기 · …」에 JSON 으로 들어간다. 여러 명이면 배열 하나로 묶고,
 * 너무 길면 「(1/3)」처럼 나눠 담는다. 핸드아웃 내용을 통째로 복사해서 툴의 보관함에 붙여넣으면 된다.
 *
 * 시트 양식을 몰라도 되게 모든 속성·반복 항목(스킬·아이템)·매크로를 그대로 담고,
 * 캐릭터 그림(avatar)과 기본 토큰 그림(token)의 주소도 함께 담는다.
 */
var VttCharacterExport =
  VttCharacterExport ||
  (function () {
    "use strict";

    var VERSION = "0.2.0";
    var CHUNK = 400000; // 핸드아웃 하나에 담을 JSON 길이 (글자)

    function esc(s) {
      return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    // 표시 이름으로 귓속말하면 이름에 따라 안 갈 때가 있어서, GM 전체에게 보낸다
    function whisper(text) {
      sendChat("VTT 내보내기", "/w gm " + text);
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
        id: id,
        name: character.get("name"),
        avatar: character.get("avatar") || "",
        token: "",
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

    // 기본 토큰은 비동기로만 읽힌다
    function withToken(character, data, done) {
      try {
        character.get("_defaulttoken", function (json) {
          try {
            var t = json ? JSON.parse(json) : null;
            if (t && t.imgsrc) data.token = t.imgsrc;
          } catch (e) {
            /* 토큰이 없거나 형식이 다르면 그냥 넘어간다 */
          }
          done(data);
        });
      } catch (e) {
        done(data);
      }
    }

    function isEnemy(character) {
      var a = findObjs({ _type: "attribute", _characterid: character.id, name: "enemy_sheet_toggle" })[0];
      return !!a && String(a.get("current")).toLowerCase().indexOf("enemy") === 0;
    }

    function writeHandouts(baseTitle, list) {
      var json = JSON.stringify(list.length === 1 ? list[0] : list, null, 1);
      // 길면 캐릭터 단위로 나눈다 (JSON 이 중간에 잘리지 않게)
      var parts = [];
      if (json.length <= CHUNK || list.length === 1) {
        parts.push(json);
      } else {
        var cur = [];
        var size = 0;
        list.forEach(function (d) {
          var s = JSON.stringify(d, null, 1).length;
          if (cur.length && size + s > CHUNK) {
            parts.push(JSON.stringify(cur, null, 1));
            cur = [];
            size = 0;
          }
          cur.push(d);
          size += s;
        });
        if (cur.length) parts.push(JSON.stringify(cur, null, 1));
      }
      var titles = parts.map(function (p, i) {
        var title = parts.length > 1 ? baseTitle + " (" + (i + 1) + "/" + parts.length + ")" : baseTitle;
        var handout = findObjs({ _type: "handout", name: title })[0];
        if (!handout) handout = createObj("handout", { name: title, inplayerjournals: "", archived: false });
        handout.set("notes", "<pre>" + esc(p) + "</pre>");
        return title;
      });
      return titles;
    }

    function exportAll(chars, title) {
      var out = [];
      var i = 0;
      whisper(chars.length + "명 내보내는 중…");
      function next() {
        if (i >= chars.length) {
          var titles = writeHandouts(title, out);
          whisper(
            "<b>" + out.length + "명</b> 내보냄 — 핸드아웃 " +
              titles.map(function (t) { return "「" + esc(t) + "」"; }).join(", ") +
              "의 내용을 통째로 복사해서 툴 보관함에 붙여넣으세요.",
          );
          return;
        }
        var c = chars[i++];
        withToken(c, collect(c), function (data) {
          out.push(data);
          setTimeout(next, 0); // 캐릭터가 많아도 샌드박스가 멈추지 않게 하나씩
        });
      }
      next();
    }

    function handle(msg) {
      if (msg.type !== "api" || msg.content.indexOf("!vtt-export") !== 0) return;
      log("VttCharacterExport: " + msg.content + " (selected " + (msg.selected ? msg.selected.length : 0) + ")");
      try {
        run(msg);
      } catch (e) {
        log("VttCharacterExport error: " + (e && e.stack ? e.stack : e));
        whisper("내보내기 중 오류: " + esc(e && e.message ? e.message : e));
      }
    }

    function run(msg) {
      if (!playerIsGM(msg.playerid)) return whisper("GM만 쓸 수 있어요.");

      var arg = msg.content.replace(/^!vtt-export\s*/, "").trim();
      if (arg === "ping") return whisper("VTT 내보내기 " + VERSION + " 작동 중이에요.");

      var chars = [];
      var title = "VTT 내보내기 · 선택";
      var all = arg.match(/^all(?:\s+(pc|enemy))?$/i);
      if (all) {
        chars = findObjs({ _type: "character" });
        var only = all[1] && all[1].toLowerCase();
        if (only) chars = chars.filter(function (c) { return only === "enemy" ? isEnemy(c) : !isEnemy(c); });
        chars.sort(function (a, b) { return a.get("name").localeCompare(b.get("name")); });
        title = "VTT 내보내기 · 전체" + (only ? " " + only.toUpperCase() : "");
      } else if (arg) {
        chars = findObjs({ _type: "character", name: arg });
        title = "VTT 내보내기 · " + arg;
      } else if (msg.selected) {
        msg.selected.forEach(function (s) {
          var g = getObj("graphic", s._id);
          var c = g && g.get("represents") && getObj("character", g.get("represents"));
          if (c && chars.indexOf(c) < 0) chars.push(c);
        });
        if (chars.length === 1) title = "VTT 내보내기 · " + chars[0].get("name");
      }
      if (!chars.length) {
        return whisper("캐릭터를 찾지 못했어요. 토큰을 선택하거나 <code>!vtt-export 이름</code> / <code>!vtt-export all</code> 로 쓰세요.");
      }
      exportAll(chars, title);
    }

    on("ready", function () {
      on("chat:message", handle);
      log("VttCharacterExport " + VERSION + " ready");
      whisper("VTT 내보내기 " + VERSION + " 준비됨 — <code>!vtt-export all</code> 로 전체, 토큰 선택 후 <code>!vtt-export</code>");
    });

    return { collect: collect };
  })();
