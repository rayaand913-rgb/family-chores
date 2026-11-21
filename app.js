(() => {
  const SUPABASE_URL = "https://xjksahyxtnhdbnciwqcg.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhqa3NhaHl4dG5oZGJuY2l3cWNnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUyMjM4OTMsImV4cCI6MjExMDc5OTg5M30.FqW3d9wA2HrBRi9tg5vdU3AlJn945B7N2c4MmrNFDaM";
  const STORE_CODE = "little-wins-family-code";
  const STORE_PERSON = "little-wins-person";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const client = window.supabase && window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  let inviteCode = "";
  let household = null;
  let chores = [];
  let realtimeChannel = null;
  let toastTimer;

  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 2300);
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (_) {}
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.left = "-9999px";
    helper.style.top = "0";
    document.body.appendChild(helper);
    helper.focus();
    helper.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch (_) {}
    helper.remove();
    return copied;
  }

  function showSetup(message) {
    $("#setupPanel").hidden = false;
    $("#summaryPanel").hidden = true;
    $("#boardPanel").hidden = true;
    $("#shareBtn").classList.remove("ready");
    $("#setupError").textContent = message || "";
  }

  function showBoard() {
    $("#setupPanel").hidden = true;
    $("#summaryPanel").hidden = false;
    $("#boardPanel").hidden = false;
    $("#shareBtn").classList.add("ready");
    $("#familyName").textContent = household ? household.name : "Our family board";
  }

  function readCode(value) {
    const raw = String(value || "").trim();
    if (/^https?:\/\//i.test(raw)) {
      try { return new URLSearchParams(new URL(raw).hash.slice(1)).get("invite") || ""; }
      catch (_) { return ""; }
    }
    return raw.replace(/^#?invite=/i, "").trim().toLowerCase();
  }

  async function api(action, extra) {
    const result = await client.functions.invoke("family-board", { body: Object.assign({ action, inviteCode }, extra || {}) });
    if (result.error) {
      let message = result.error.message || "The family list could not be reached.";
      try {
        const details = await result.error.context.json();
      if (details.error) message = details.error;
      } catch (_) {}
      throw new Error(message);
    }
    if (result.data && result.data.error) throw new Error(result.data.error);
    return result.data;
  }

  function shape(row) {
    return { id: row.id, name: row.chore_name, date: row.date_added, person: row.assigned_to, points: Number(row.points), done: Boolean(row.completed), completedBy: row.completed_by || "" };
  }

  function fmtDate(value) {
    return new Date(value + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  function initials(name) {
    return String(name || "Anyone").trim().split(/\s+/).filter(Boolean).slice(0, 2).map((v) => v.charAt(0).toUpperCase()).join("") || "✦";
  }

  function colorFor(name) {
    const colors = ["#f3ddca", "#dce8d5", "#e9def1", "#f5e9b9", "#e5eee7", "#dcecf0"];
    let hash = 0;
    for (const c of String(name)) hash = (hash * 31 + c.charCodeAt(0)) >>> 0;
    return colors[hash % colors.length];
  }

  function rowHtml(c) {
    const check = c.done ? '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m3 8 3 3 7-7"/></svg>' : "";
    const editIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>';
    const trashIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m4 4v6m6-6v6"/></svg>';
    return '<tr class="' + (c.done ? "completed" : "") + '">' +
      '<td><div class="task-name"><button class="task-check ' + (c.done ? "done" : "") + '" data-action="toggle" data-id="' + esc(c.id) + '" aria-label="Mark ' + (c.done ? "to do" : "complete") + ': ' + esc(c.name) + '">' + check + '</button><span class="task-label">' + esc(c.name) + '</span></div></td>' +
      '<td class="date">' + fmtDate(c.date) + '</td>' +
      '<td><div class="person"><i class="avatar" style="background:' + colorFor(c.person) + '">' + esc(initials(c.person)) + '</i>' + esc(c.person) + '</div></td>' +
      '<td><span class="points">' + Number(c.points).toLocaleString() + ' pts</span></td>' +
      '<td><div class="row-actions"><button class="icon-btn" data-action="edit" data-id="' + esc(c.id) + '" aria-label="Edit ' + esc(c.name) + '">' + editIcon + '</button><button class="icon-btn" data-action="delete" data-id="' + esc(c.id) + '" aria-label="Delete ' + esc(c.name) + '">' + trashIcon + '</button></div></td></tr>';
  }

  function render() {
    const people = Array.from(new Set(chores.map((c) => c.person).filter(Boolean))).sort((a, b) => a.localeCompare(b));
    const savedPerson = localStorage.getItem(STORE_PERSON) || "";
    const personalInput = $("#myPerson");
    if (document.activeElement !== personalInput) personalInput.value = savedPerson;
    const personFilter = $("#personFilter");
    const oldPerson = personFilter.value;
    personFilter.innerHTML = '<option value="all">Everyone</option>' + people.map((p) => '<option value="' + esc(p) + '">' + esc(p) + '</option>').join("");
    personFilter.value = people.includes(oldPerson) ? oldPerson : "all";
    const status = $("#statusFilter").value;
    const visible = chores.filter((c) => (personFilter.value === "all" || c.person === personFilter.value) && (status === "all" || (status === "done" ? c.done : !c.done)));
    $("#choreRows").innerHTML = visible.map(rowHtml).join("");
    $("#empty").hidden = visible.length > 0;
    const currentPerson = personalInput.value.trim();
    const earned = currentPerson ? chores.filter((c) => c.done && c.completedBy.toLowerCase() === currentPerson.toLowerCase()).reduce((sum, c) => sum + Number(c.points || 0), 0) : null;
    $("#totalPoints").innerHTML = (earned === null ? "—" : earned.toLocaleString()) + " <small>pts</small>";
    $("#myPointsNote").textContent = currentPerson ? "Points from chores checked off by " + currentPerson + "." : "Enter your name before checking off a chore.";
    $("#remaining").textContent = chores.filter((c) => !c.done).length;
    $("#helperCount").textContent = new Set(chores.map((c) => c.person).filter((p) => p && p.toLowerCase() !== "anyone")).size;
    $("#listCount").textContent = chores.length + " " + (chores.length === 1 ? "chore" : "chores") + " on the list";
    $("#footCount").textContent = chores.filter((c) => c.done).length + " done · " + chores.filter((c) => !c.done).length + " still to do";
    $("#personOptions").innerHTML = people.map((p) => '<option value="' + esc(p) + '"></option>').join("");
  }

  async function refresh(silent) {
    const data = await api("load");
    household = data.household;
    chores = data.chores.map(shape);
    showBoard();
    render();
  }

  async function subscribe() {
    if (realtimeChannel) await client.removeChannel(realtimeChannel);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(inviteCode));
    const topicKey = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    realtimeChannel = client.channel("family-" + topicKey)
      .on("broadcast", { event: "changed" }, () => refresh(true).catch(() => {}))
      .subscribe();
  }

  async function connect(value) {
    const code = readCode(value);
    if (!/^[a-z0-9]{6,64}$/.test(code)) throw new Error("Enter the family password to continue.");
    inviteCode = code;
    await refresh(false);
    localStorage.setItem(STORE_CODE, inviteCode);
    history.replaceState(null, "", location.pathname + location.search);
    await subscribe();
  }

  function openForm(c) {
    $("#choreForm").reset();
    $("#editId").value = c ? c.id : "";
    $("#choreName").value = c ? c.name : "";
    $("#chorePerson").value = c ? c.person : "Anyone";
    $("#chorePoints").value = c ? c.points : 100;
    $("#modalTitle").textContent = c ? "Edit chore" : "Add a little win";
    $("#choreDialog").showModal();
    setTimeout(() => $("#choreName").focus(), 50);
  }

  async function save(c) {
    await api("save", { chore: {
      id: c ? c.id : crypto.randomUUID(),
      choreName: $("#choreName").value.trim(),
      dateAdded: c ? c.date : new Date().toISOString().slice(0, 10),
      assignedTo: $("#chorePerson").value.trim() || "Anyone",
      points: Math.max(0, Number($("#chorePoints").value) || 0),
      completed: c ? c.done : false,
      completedBy: c ? c.completedBy : null
    }});
    await refresh(true);
    toast(c ? "Chore updated" : "Chore added to the list");
  }

  async function start() {
    $("#togglePassword").addEventListener("click", () => {
      const input = $("#inviteInput");
      const showing = input.type === "password";
      input.type = showing ? "text" : "password";
      const button = $("#togglePassword");
      button.setAttribute("aria-label", showing ? "Hide password" : "Show password");
      button.setAttribute("aria-pressed", String(showing));
      button.innerHTML = showing
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A10.8 10.8 0 0 1 12 5c6.4 0 10 7 10 7a16 16 0 0 1-3.1 4.1M6.2 6.2C3.5 8 2 12 2 12s3.6 7 10 7c1 0 1.9-.2 2.7-.5"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
    $("#inviteForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      $("#openInviteBtn").disabled = true;
      $("#setupError").textContent = "Connecting to your family list…";
      try { await connect($("#inviteInput").value); }
      catch (error) { $("#setupError").textContent = error.message; }
      finally { $("#openInviteBtn").disabled = false; }
    });
    $("#shareBtn").addEventListener("click", async () => {
      const link = location.origin + location.pathname + "#invite=" + inviteCode;
      $("#familyLink").value = link;
      if (await copyText(link)) toast("Family link copied");
      else {
        $("#shareMessage").textContent = "Automatic copying was blocked. Press and hold the link below, then choose Copy.";
        $("#shareDialog").showModal();
        $("#familyLink").focus();
        $("#familyLink").select();
      }
    });
    $("#closeShare").addEventListener("click", () => $("#shareDialog").close());
    $("#copyAgain").addEventListener("click", async () => {
      const copied = await copyText($("#familyLink").value);
      if (copied) {
        $("#shareDialog").close();
        toast("Family link copied");
      } else {
        $("#shareMessage").textContent = "Copy is still blocked. Press and hold the selected link above, then choose Copy.";
        $("#familyLink").focus();
        $("#familyLink").select();
      }
    });
    $("#addBtn").addEventListener("click", () => openForm(null));
    $("#cancelBtn").addEventListener("click", () => $("#choreDialog").close());
    $("#choreForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const c = chores.find((item) => item.id === $("#editId").value);
      const button = $("#choreForm").querySelector('button[type="submit"]');
      button.disabled = true;
      try { await save(c); $("#choreDialog").close(); }
      catch (error) { toast(error.message); }
      finally { button.disabled = false; }
    });
    $("#choreRows").addEventListener("click", async (event) => {
      const button = event.target.closest("[data-action]");
      if (!button) return;
      const c = chores.find((item) => item.id === button.dataset.id);
      if (!c) return;
      if (button.dataset.action === "edit") return openForm(c);
      if (button.dataset.action === "toggle" && !c.done && !$("#myPerson").value.trim()) {
        toast("Enter your name under Your points before checking off a chore.");
        $("#myPerson").focus();
        return;
      }
      button.disabled = true;
      try {
        if (button.dataset.action === "toggle") {
          const completedBy = c.done ? null : $("#myPerson").value.trim();
          await api("save", { chore: { id: c.id, choreName: c.name, dateAdded: c.date, assignedTo: c.person, points: c.points, completed: !c.done, completedBy } });
          await refresh(true);
          toast(c.done ? "Moved back to to do" : "Nice work! Points earned 🎉");
        } else {
          await api("delete", { choreId: c.id });
          await refresh(true);
          toast("Chore removed");
        }
      } catch (error) { toast(error.message); }
      finally { button.disabled = false; }
    });
    $("#personFilter").addEventListener("change", render);
    $("#statusFilter").addEventListener("change", render);
    $("#myPerson").addEventListener("input", () => {
      const person = $("#myPerson").value.trim();
      if (person) localStorage.setItem(STORE_PERSON, person);
      else localStorage.removeItem(STORE_PERSON);
      render();
    });

    const fromLink = new URLSearchParams(location.hash.slice(1)).get("invite");
    const saved = localStorage.getItem(STORE_CODE);
    if (!fromLink && !saved) return showSetup("");
    try { await connect(fromLink || saved); }
    catch (error) {
      localStorage.removeItem(STORE_CODE);
      showSetup(error.message);
    }
  }

  if (!client) showSetup("The family list could not load. Refresh the page and try again.");
  else start().catch((error) => showSetup(error.message));
})();
