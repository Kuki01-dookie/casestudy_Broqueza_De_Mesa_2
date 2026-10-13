/* ===== OTHER VARIABLES ===== */
var me = "";           // the logged-in user ("" = nobody)
var currentPage = "";    // the page that is open
var searchText = "";    // what is typed in the search box (lowercase)
var chosenClass = 0;     // the class picked in the record sheet or computing page

var chosenStudent = 0;   // the student picked in the list of the Enter Grades page
var DAYS = ["M", "T", "W", "TH", "F", "S"];
var DAY_NAMES = { M: "Monday", T: "Tuesday", W: "Wednesday", TH: "Thursday", F: "Friday", S: "Saturday" };

// ---------- Load and save (the browser remembers the data) ----------



// ---------- Helper functions ----------
function setMessage(text) { document.getElementById("message").innerHTML = text; }

function safe(text) {          // stops typed text from breaking the page
  if (text === undefined) { text = ""; }
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function show(pageId) {        //show one section, hide the others
  var pages = document.getElementsByTagName("section");
  for (var i = 0; i < pages.length; i++) { pages[i].style.display = "none"; }
  document.getElementById(pageId).style.display = "block";
}

function findIndex(list, id) {
  for (var i = 0; i < list.length; i++) {
    if (list[i].id === id) { return i; }
  }
  return -1;
}
function findUser(id)  { var i = findIndex(users, id);   return i >= 0 ? users[i]   : ""; }
function findClass(id) { var i = findIndex(classes, id); return i >= 0 ? classes[i] : ""; }

function nextId(list) {
  var biggest = 0;
  for (var i = 0; i < list.length; i++) {
    if (list[i].id > biggest) { biggest = list[i].id; }
  }
  return biggest + 1;
}

function teacherName(id) {
  var t = findUser(id);
  if (t === "") { return "Unassigned"; }
  return t.name;
}

function isEmpty(v) { return v === "" || v === undefined; }   // undefined = the box was never created

function avgOf(list) {         // average of the boxes that have a number. "" if there are none
  var total = 0;
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    if (!isEmpty(list[i])) { total = total + Number(list[i]); count = count + 1; }
  }
  if (count === 0) { return ""; }
  return total / count;
}

function fixed(n, digits) { if (n === "") { return "-"; } return n.toFixed(digits); }

function studentsOf(section) {
  var list = [];
  for (var i = 0; i < users.length; i++) {
    if (users[i].role === "student" && users[i].section === section) { list.push(users[i]); }
  }
  return list;
}

function classesOf(section) {
  var list = [];
  for (var i = 0; i < classes.length; i++) {
    if (classes[i].section === section) { list.push(classes[i]); }
  }
  return list;
}

function myClasses() {         // teacher: own classes. admin: all classes
  var list = [];
  for (var i = 0; i < classes.length; i++) {
    var c = classes[i];
    if (me.role === "admin" || c.teacherId === me.id) { list.push(c); }
  }
  return list;
}

function sectionTag(section) { // "11 - GAS" -> "GAS"
  var parts = String(section).split(" ");
  return parts[parts.length - 1];
}

function statsList(items, stacked) {    // items = [[value, label], ...]  -> a <ul class="stats"> with one box for each
  var html = "<ul class='stats" + (stacked ? " stack" : "") + "'>";
  for (var i = 0; i < items.length; i++) {
    if (stacked) { html += "<li><b>" + items[i][0] + "</b><br>" + items[i][1] + "</li>"; }
    else { html += "<li><b>" + items[i][0] + "</b> - " + items[i][1] + "</li>"; }
  }
  return html + "</ul>";
}

function initials(name) {      // "Calapi, Kristina Cassandra" -> "CK"
  var parts = String(name).split(", ");
  var letters = parts[0].charAt(0);
  if (parts.length > 1) { letters = letters + parts[1].charAt(0); }
  return safe(letters.toUpperCase());
}

// ---------- Grade rules ----------
function passing() { return settings.passing; }

// The three parts of a quarter grade (like the Enter Grades design). count = how many columns each part has.
var COMPS = [
  { key: "ww", name: "Written Works", count: 4 },
  { key: "pt", name: "Performance Task", count: 4 },
  { key: "qa", name: "Quarterly Assessment", count: 3 }
];
var TERMS = [["q1", "1st Quarter"], ["q2", "2nd Quarter"]];
var DEFAULT_ITEMS = { ww: [20, 25, 20, 20], pt: [15, 15, 25, 20], qa: [50, 50, 50] };   // "No. of Items" of a new class

function weightTotal() { var w = settings.weights; return w.ww + w.pt + w.qa; }

function defaultItems() {      // { ww1: 20, ww2: 25, ... }
  var items = {};
  for (var i = 0; i < COMPS.length; i++) {
    for (var n = 1; n <= COMPS[i].count; n++) { items[COMPS[i].key + n] = DEFAULT_ITEMS[COMPS[i].key][n - 1]; }
  }
  return items;
}

function getItems(c, term, create) {   // the "No. of Items" row of one class and one quarter
  if (c.items && c.items[term]) { return c.items[term]; }
  var items = defaultItems();
  if (create) {
    if (!c.items) { c.items = {}; }
    c.items[term] = items;
  }
  return items;
}

function getRecord(studentId, classId, create) {   // the scores of one student in one class
  for (var i = 0; i < grades.length; i++) {
    var g = grades[i];
    if (g.studentId === studentId && g.classId === classId) {
      if (create) {
        if (!g.q1) { g.q1 = {}; }
        if (!g.q2) { g.q2 = {}; }
      }
      return g;
    }
  }
  if (create) {
    var r = { studentId: studentId, classId: classId, q1: {}, q2: {} };
    grades.push(r);
    return r;
  }
  return "";
}

// One part (comp) of one quarter. total = sum of the scores, max = sum of the items,
// ps = percentage score = total / max x 100, wa = weighted average = ps x weight. done = every score is typed.
function compOf(c, term, comp, data) {
  var items = getItems(c, term, false);
  var r = { total: 0, max: 0, done: true, any: false, ps: "", wa: "" };
  for (var n = 1; n <= comp.count; n++) {
    var key = comp.key + n;
    r.max = r.max + Number(items[key]);
    if (isEmpty(data[key])) { r.done = false; } else { r.total = r.total + Number(data[key]); r.any = true; }
  }
  if (r.max > 0 && r.any) {
    r.ps = r.total / r.max * 100;
    r.wa = r.ps * settings.weights[comp.key] / weightTotal();
  }
  return r;
}

function termGrade(c, term, data) {   // quarterly grade = WA of Written Works + Performance Task + Quarterly Assessment. "" if a score is missing
  var sum = 0;
  for (var i = 0; i < COMPS.length; i++) {
    var r = compOf(c, term, COMPS[i], data);
    if (!r.done || r.wa === "") { return ""; }
    sum = sum + r.wa;
  }
  return Math.round(sum * 100) / 100;
}

function getResult(studentId, classId) {   // 1st quarter, 2nd quarter and the final grade
  var c = findClass(classId);
  var rec = getRecord(studentId, classId, false);
  var q1 = "";
  var q2 = "";
  if (c !== "" && rec !== "") {
    q1 = termGrade(c, "q1", rec.q1 ? rec.q1 : {});
    q2 = termGrade(c, "q2", rec.q2 ? rec.q2 : {});
  }
  var rating = "";
  if (q1 !== "" && q2 !== "") { rating = Math.round((q1 + q2) / 2); }
  return { q1: q1, q2: q2, rating: rating };
}

//----------remarks ----------
// Each row of settings.scale has a descriptor, a min and max rating, and the remarks.
function scaleRow(rating) {    // the row of the scale that holds this rating. "" if none
  var scale = settings.scale;
  for (var i = 0; i < scale.length; i++) {
    if (rating >= scale[i].min && rating <= scale[i].max) { return scale[i]; }
  }
  return "";
}

function descriptorOf(rating) {   // 92 -> "Outstanding"
  if (rating === "") { return "-"; }
  var row = scaleRow(rating);
  if (row === "") { return "-"; }
  return safe(row.descriptor);
}

function remarks(rating) {        // 92 -> PASSED (green), 70 -> FAILED (red), no rating -> INC
  if (rating === "") { return "INC"; }
  var row = scaleRow(rating);
  if (row === "") { return "-"; }
  var css = (row.remarks === "Passed") ? "good" : "bad";
  return "<span class='" + css + "'>" + safe(row.remarks.toUpperCase()) + "</span>";
}

function scaleText(row) {         // min 90, max 100 -> "90-100".  min 0, max 74 -> "Below 75"
  if (row.min === 0) { return "Below " + (row.max + 1); }
  return row.min + " &ndash; " + row.max;
}

function drawScale(elementId) {   // draws the Descriptor / Grading Scale / Remarks table
  var scale = settings.scale;
  var html = "<tr><th>Descriptor</th><th>Grading Scale</th><th>Remarks</th></tr>";
  for (var i = 0; i < scale.length; i++) {
    html += "<tr><td>" + safe(scale[i].descriptor) + "</td><td>" + scaleText(scale[i]) + "</td><td>" + safe(scale[i].remarks) + "</td></tr>";
  }
  html += "<tr><td>Incomplete</td><td>a score is missing</td><td>INC</td></tr>";
  document.getElementById(elementId).innerHTML = html;
}

function ratingText(rating) {
  if (rating === "") { return "-"; }
  if (rating < passing()) { return "<span class='bad'>" + rating + "</span>"; }
  return String(rating);
}

function classStats(c) {       // numbers about one class
  var list = studentsOf(c.section);
  var st = { students: list.length, total: 0, count: 0, passed: 0, failed: 0, inc: 0, high: "", low: "", average: "" };
  for (var i = 0; i < list.length; i++) {
    var res = getResult(list[i].id, c.id);
    if (res.rating === "") {
      st.inc++;
    } else {
      st.total = st.total + res.rating;
      st.count++;
      if (res.rating >= passing()) { st.passed++; } else { st.failed++; }
      if (st.high === "" || res.rating > st.high) { st.high = res.rating; }
      if (st.low === "" || res.rating < st.low) { st.low = res.rating; }
    }
  }
  if (st.count > 0) { st.average = st.total / st.count; }
  return st;
}

function studentStats(s) {     // numbers about one student
  var list = classesOf(s.section);
  var st = { subjects: list.length, passed: 0, failed: 0, inc: 0, total: 0, count: 0, best: "", worst: "", average: "" };
  var parts = { ww: [], pt: [], qa: [] };

  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var res = getResult(s.id, c.id);
    if (res.rating === "") {
      st.inc++;
    } else {
      st.total = st.total + res.rating;
      st.count++;
      if (res.rating >= passing()) { st.passed++; } else { st.failed++; }
      if (st.best === "" || res.rating > st.best.rating) { st.best = { code: c.code, rating: res.rating }; }
      if (st.worst === "" || res.rating < st.worst.rating) { st.worst = { code: c.code, rating: res.rating }; }
    }
    var rec = getRecord(s.id, c.id, false);
    if (rec !== "") {
      for (var t = 0; t < TERMS.length; t++) {
        var data = rec[TERMS[t][0]] ? rec[TERMS[t][0]] : {};
        for (var k = 0; k < COMPS.length; k++) {
          var r = compOf(c, TERMS[t][0], COMPS[k], data);
          if (r.done) { parts[COMPS[k].key].push(r.ps); }
        }
      }
    }
  }
  if (st.count > 0) { st.average = st.total / st.count; }
  st.ww = avgOf(parts.ww);
  st.pt = avgOf(parts.pt);
  st.qa = avgOf(parts.qa);
  return st;
}

// ---------- Logo ----------
var LOGO_SRC = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAADjR0lEQVR42uz9159k2XXfC373seG9TW8rM8t2d3VXWzQBNBogRCsCJEReUdSVNK9zn/VG/hMzL3NH90q6uhrxkpQ0IkASALvRaABtq8vb9D4zvI84bs9DZERFZlU3QBLzxvP5RJmIEyeOWXvt3/qt31ob/nH7x+0ft3/c/nH7x+0ft3/c/v++ie/93//t534oAXHy9+kP5Ofuf3o3CUI8vd/I9+WZP5/6PSmRjO4vn3xfnv19efo90f+j//2To8v+7w92E+Lkc+/Jd6Qc7C3x5DPOT0oUBRRFQQgFVREnX1UAyfCKhTjZ33vyuTg5h5NjevLJ357nIYTA9bz++wKUkYsRI+fMqX+fvhGj+wkhTt1vgRjuIJ468unHJRAn/xenLEKI0w9cCDG8Vk6euTL6jZMvSClRTs539P4rI58Pj3NyrOHzecYVnj5Sf9NG7UI842vyzOUwaqTy2T8lR4751PfP/F7/hj85sdGxMjCj0QeCkIhTRnrKhJBi5CD9u3nq96SU/Y8Hl+BJvL6V40mQQiJQ0BQFXVURQkERoCBQEHjSo2v1aHQ6NHsdmt2ebNs9HMfFdl2avS6u56EIgRwatBwxnP75qIrA0DR0RUVTVaKBANFAEEDEAkFi/iBCURgMZ09KbM/F8zwc18WVHkI+MYiB0QghkfLMHT/5fSnEKYN94nBGz2/gFMSId5GnDeSs0xg9/ohdiBE7OeUMh+d62sHJM6Y6aggS+eQav8CRar9sly+/aDr4OZ///GNLpMcZcwZx4l4l4hlf8kCc+Fsp8QZG7UmE0jcGTSioqoquqCDBdl1a3Q7FTotGp4PlSWnh4iHQDJ2O06NpWVieS8u2EZqGi6TebdHsdXE8icqoZ3liCQJlxKBVTE1DEYKw1yPQa2NZlgyoGmHDRBMCVYLwPHyaTjQQEEHTTywUwm8YOK6DKyXuwMg9D5Aooj8TCHnW456eHc8ax+D+KiNveiOfK89wSMN9pESRcmjU3sBhjRxDCDGckUZ/13vqPHjGkxS/kI1oz/Kg4gsgws81ulPeVJw61lM3jxNbk3LkHEbdp3xyV0ZO0DtzPvLUd5/+4ImnBwUFlCfTv+O5WLaN5bp4ngsIWo4jy50Wx40aR7UqTc+j6dm0XAfNMGn3urjSI+gLoOkGyUQSVdVpuxI9EERH4QSrPD3MBw9cShxP4iogpUOx26FbqyKlxLIdelYX1XXxIzAQZEIRJhJJGVB1xqMx4oEgrnSFrijoqoahqvh0rT/LSPkEVp29V6PwYwBHRjypQDwBWGcsSw59+Kj3FE/DxxFMIs+OqFNPSjz10bPOb3AM+QzDlyOASQLaCaQbndGfNmzx9GGe/OvJIfvTwsjxpDz1MD3RP2ExcmPkECcNsK1E4p12DWfHqjhjyHJkpjyLv4VAunI4gKQATagYmorjeRTrDQ5rZblZLrJdKdFyHaRpEknEiEajEEgR0lQCEjrdLs1Wi2K5SKFQxHW84fkPoJGi/LxJ8dScjyefYF2f30cmnSaTy2LoCaxeD01V8fv9hEIhSo7LzZ0dKg/voLouEd2Q6VCEc9kc58cmyMdiwgV6toPneSfG+uT4A+N+cv8GcYV3Cl8PbUpIhBRf8Lz7xxJn/I8cOChxAg4lz3SZTzA1w+cvxMiQGvoz+QV3c/S6BOJ7/8u/HZ7RMz3xUwHcF7rnp39Ynr4Zw0E8+t7g9z15ap/hIBmZmuTIQ5GjmHhkhEvAO5l+NVVDUzUChoGUkv1ymUf7+2yXjmXDs/H8PvyRMEbQT096lGpVCuUiPcvC8yTNRhfXkQipoioKhg6O00Z6PUy/RjBooOsQDEAyruLze0PP8uRRKSe3fhAPSBxbUG9IqlXoWpJuz6XXc9FUH5oWxLYlzXYH23EwDBV/0MT06Zg+g3g8Tiwcwem61CsVNM9DtR2cZpuoz8eV6RnOjU2KiM+PX9exHJuObeGdnJOiiJOAT5wCgoOYRsgzAaQ8HYCeCkpPgkQ5isHFSMD3LAMcGdujQepZVzCcnIX4QowrRiYL7ZeBbf+hWFt68tksxVkcJ09DY8kp8mJoRArg9/nQFIVau81+pUy5UafaacnjbpeOJihrLkf1BkL2MOwOgVYATdGplBsUjht02m10zcUwXEJBhWhMJZXWyOdDpJIZEjGDaFwlGlEIBCTBgEssIvEF+jjZcyWCweyj9LHlCX2iCA/bljSaklpN0rE0mm1BteJRr0mKRYdCqUO5DIVjj1q9R7PapNwT+PwhhG0iHB3bdmh0Ozj9wALHEBTsDvWddW7v78mQqpOPx5nJZEQuFidoGCAlPcfBdd0TD670veyz7vEvgFzlF2DV/lwrvvAY8hRo+PwZ7Re1Ue1ZOGv4fyHOzPHP2G9kKpPP8uriNFKRnzf9PvNy5CkG5Cy1dxZvKSee0fU86p02tVaL9VJBblZKbFdLHLebeKbJ0uIC6UwK5+CYSrnM3u4WzWYLRZH4/SrRmI+FhRDzsxGWFwNMTWvk8pJUxiOZMIkEdfw+F11voygdUHr9YefKJ6yK9BA4JyennJy0AKn09x2MPCQIE2QQzw3S6xk0moJq3aJStjg8EOwfqGzveqytNVhdK3FceMTWtk2vJzEMH7FojOnpKbLZHO1Oi7WNdW7u7aJKhbBpcjGXl5fyE+SjMSJ+v/DpBoamoQhwPTkSk5wxG/E0wfG0GZxQbQM4KUZjoNMzsDjDipyKlT5nEElx2lvLzyFbhvt873/5t0/xvqMQ5KmRMXxg8lQwdwqyiCeR7yi+fgoejNBFTzDUyciWzwpong78PE/iSQ9NVVGEoNbtUO90uL6xJn+8ep+m9Mjm88zNzxEIBNg93Of48IhKqUqr1cZnqsRiBhPjIVaW41y+FGJ5ySA75hKOWEQDHUyjhaZ2UZAIqaMoArDxPBvPVXAcE9f1YTs6tqciBGhqB11vYWo2miqHs4rravRsg55rAiq65mCoFrrmoGh9mOR5Jy8B4Mf2InStIM22Trks2NtVuHvX5tPPqty/X+a40KLdtpCeIBwOkUjFmZ9fJJ3KsLm5yZ3bt6iVyuRjUS6MT/LizByL2bwI+3zYroPt9v2oIvrU5GiscgoCDOk28cyQbrC/OOPyT/Pcp4O40/DlyXvicyDIs7izUcghvvu//NunPe8ZjyzP8pYDryzl0/udiR8Hgckovj2VWJGnPa5QTuNiOYKTvJOg0ZP9lyoUfIaBrmrslItc31iTG6VjanYPggGMWAShCKrVCu1mG8+FVquNEA6ZtM7ycpCVlSDnFv1MT6rkcpJ0yiYabIPeBumA64Ln9T2rK/CkjZRdLEel1U7TbE5SraeoVHVqTUGvp6AqCtGIRybdJJ08Jhraw1QbSE+j0w1yVJ5h93iMRlMjEOyRSZbIJQ4Ih45RlR6248eTQVRdRdNtNM1B0SToCqDjdgOUKz4OjlV2tl22d1wePOpw/16D7e0elaqHaQYJRwKAi1QgFI5gaibVo2N61Sox02R5fIIXpueZz+SELgTNbgfX699sVVFOaDrBE5g7+m+eSiANjVqcTdSIpxI+Ep5ttKPM2CDp8iwPPvjDO3nnZBL8+/HQnveFQP0E0p0BZp+/v8eTAMrzzuw9QtUNpkZNUTE0DctxWC8csXq4L1ePjzi0OnimhmUITFVgSpVOvcfRbplKrUAqpfPccykuX85y6aKPCysK01OQSnhgNMFrgNXDats4VRXXCeK4PoTious2hm4jFA/bNak1s2wfnOPxWorNbZViyaXVUrBtiSI8gkGVybEQSwsBLi7BWGYXVbGx3SDlWp7b93KsbdqEY5LnLgYJ+R1CgQa26+O4PMVhYZxeT+D3t4hFS8TDh4QDBXTTRdU00qkA6fEQl58L4LSDHBxFWF1Ncftum89u1rh1s8z61j5WVyMeTxMLJQn4Q/RiFl0Fduo19lYf8vjgiPNjY3JpbJzJeELE/EEcz6Nr2zhS9pNKZ5JTAy8k+XmJjqfx8bOyyeKLbOnvyERrPCs9/SzPfDbaHPXO4mnYIZ863NN4eOh+5ens4ihDIkfoUEVVhomPcrvJVrEgP93Z5NOdDXoCZianyGayWD2Lra0dHt17gOnzmBwP8+Uvz/Lyywl+5c0wCwsOkVAFQRVpdXGbHtLx8CRYTpRaa4JyLUmrHUIoOrFohVRiC91oIF2NZmucnb15Pr2d5ZMbdY6PWpiqQjCoI4FGt8fBMRQKYexekGQsTyLWwGeUsF1Bq+1xeFhi9XGFWCLI7JiKlA6KYtHtBTko5Pj4RpbDA4tMJsGl8zkCs0FCfhtFtpE2uF0bSRnUKopmMJExGc/4uPZigEI5z4MH43z4SZNPPily606Rmzf38flDZDI55qdmUBTB5tYWn66v88nuOhfGp3hz/py8OD5JxB8QilDQVPUM+yVPJQ8H3viLkiKnaG6eneSRI2zGaQr5DJf+c2I6CWijQR2n6KbT04A8lcJ9dpQrz0QQchRyyNELkJ+Li4e/M+KZXSlRFYEqBS2rx1rhiHfu35G397YIJ5OsXLqM4TM4Ojrk9u1btJpNQiGD117J8+aXI7z2SoTFWUEi1iDoP0ZTu3hdj54tsLomAoFhWAhFpdeKs7M/x/V7cbZ3HUJ+hReuaASDJfzGAa7ro1QZ4/7jJDdvtSgUG2QzMS6fjzE94eJKld1Dwd6BC0A8bSL0Frano0sd29Fp9wQ920VVJCGfgt/vougWjnDpOYJiVfJws8jaWpGxUpR8Jsy5aQWhSIToU4CKOjKVOy6IJopoEtQE/pzJeDbIKy8HOTjMc/16kh+/3+L6jRpra9vs7m4xPjHO+PgEsWScUqHI2t4e93e3WcpP8MrCgrw6OSty4SjOSZAtTig2DzGS0u7rVEY9rMKTnNKQFRxkAWQfynASI501YnHGcOXgvS9wuMM9vf73tKfy7J9Dj4jPyzaNZP3OGvbQWJ+RsRvd86yBP4EYHoqiEDQMWr0eN3Y3+HDtsby7u41t6OTmZ/GbJp1Ok63tKkdHJVIJla99NcOrb8R47rLB+XMe+XQdzdcB2URaXVptnXY3Q7M9SasRQ9PaxKNbhIMlPOFSb6msb3vcf1gnGdMYz/vpzMTxAjF6dpBCOcLmFhwXWkRCfi6d9/HyiyXymT1sVyefn2B+LoLrdQgFm4RDNSQOUmr0LJ1WW6XTk2iGRyxqEolEQLg0W9BqBei0QvS6XRzXRlE8dMNC0zsIYZ3cZ2V49+VJYCxQEMJDeA6KYqNobWKRGrGIyWQ+wEsvhbn3IMY77zZ4591jtrYPKBYqRKJBctk0iWSc7d09HhwcsFcqcG9nRz43PcvFsQmRi8YA6FrWCbZW+k5OPB0aDnUy4hmZY/kMYZo8rf85lQA6uT4hBvYkPt8oT+jHf5CWQ34eRpKnVXRfjI/OeOcTg9c1FU3Rads2dw92ubG5Ie8e7HJsdVDjESaSafw+P4eHx1RrVfx+eO3VGG99NcVXvmyyvGwTDzcRsonXa2A3XJAGPTdMpTHG9u40qxtJSmWFXCbJxRUL0yyjG20C/jamriFlh46lUq6ZNBpB0vE4ds9HrWpSqUrwBIlIgIm8RTq+j8ox9VaOXueEGPdU2g2Fmhcm5IuihCx6tk6zrdLrebieQ6XR4MFjg3ojSjCwiCDIcUHDs3sE/QHiUR/RsINpNBFYI2HPk8SvUPoRvoeGlEGk5cNrS4TSQNUqhMwq55aiLM4lOL8S4dpLIX7yQZVPPiny+FGJZsMmm0kykc2STcY5PC7w4c4G9/Z2uDozJ19ZXGI5Ny4ipg9PeliOc+KNlTNqvL6jVJCfI28TeHKgFXk2A/05Qdbpmf+ZmPokvnpaXnh66hdn+WUhRtRunCjVzsCFZ5Huz/bpQ4wsRzNVgOu5VNotHh7u8/17t+Xdwz3C0Sgzk9Nk01lK5TKPVx8hRI8LF+J87a0c3/haiCuXXULhQ9xuGbvdp9QkYVQVVKHgeSHa7Qxr6zHee7/DUanC4kKCeCxBNh0nYDRJRNqMpZNsRsN0LYtSVVKsa+RtA9dWsboqtqWjoKIpDrpm9+FQI8/G5kUerPmo1Fq4jorAz9xUGNOwUPUWPdtHtyuQjkB6kuNCg3K1h+nzEQoFCPgEVrdJo9lGUTRMQ8E0OhhaD0U8KzDq30nL0Wh0o9SbKZr1GNJR8PuahIJlwv4GZqOJZu6wOGWyMJfiG98Y56OPcvz5Xxzxo/cOWFsvEI0mWDm/TDgcxdR1jo6LvLP6gM1ymS+fW5EvzM6KeCCIoWr9Z+Z5n5NQOWN18rTs9LTe5/Szf5a24YzTR55S4XFK4aedFgad/sGn5H+DkTX4XdmXU579qdH09Vm980A4c1ZU5J7gJUUKHM9jq1Tg/dUH8pONNWpWj5mZGfJjY1TLZX728Yd4TpfllRRf/eoc3/iaj4vn28Qie2iig2xZuK5Coxuk1sriOin8Rpewbw9V7eIzS+hmEFXT8SQcFzvs7QdZnJvEiN/FH6yRSo4TC4U4LjSpVyXlika7G0DDRtVsFKHjSBcbD8/VkJ6JbUtKVcHaVo1SsXzCO/dQ1DDz85ByI1i9MO22wHJsTM0kEIqgGRrtbofDwyqubaHg4noqoXCQYEDB57PQNA9V1c8IdPs6Q0cK6s0s69tL3FuNs7nrYndtEtE0k+NznJttk0ttEgrsEBY2ijwkFazx1uthlpZ8vPW1Ob77ly1+/OMin3z8CYahsbi0wKXnLnP/7n021jbY/aDAjf0t+eXF8zw/NS0ChknX81CVEe76GRY3KnYa5BkG4FqMSBvkGX5BDP2neMrBPoWpxZNch/o/vfzGqajzFIUyUDs9xVOfzhJxRsssGOhd5KgY65QKTIwkRhzXxVQ1TE2n0Gzw/uoj/vLmJ/LW7g56JMSlyxeJRSOsr22yt39IOARf//oE/+p/nuS3fl3j0lKNULCC4nVxeg7djo9qbZyt/SUePJ5lbX2MbidAPNLDHygjRJdON0K1HqNcsbFsh1DITyphEAs1UDWXejNEoRCgUukiPZd00iCXUTD1Do2Wn90DjWK5i2mqjOV8pJIWmlbD0xTCkRCZdApN91Gp1giGdWamdaJBj3I1yOMNlf0ji2BQ5/xSnucumywtwORYgHQqieOotFsuQZ/O7LTGubkKqXgBTbVOcPMTIafnKXStMDt7k3z0aYafftxjY7dFuyepN1X29xyOjlVsL47pi6BrFqpooYgmmtkgEXeYmTCYW4iRy0dxbMnOdpViqYmqgs80icbj1Nttto6OOKhWKLVaf+zXjT8Zj8cBsD13RNv+tGZ1NLnGsBhADAX8TxUUyJF3htkahkKrL6LytGfpXn8u3+w9Uc+JZ2BicQYTi2ckK72R4gC/YWK7Dg8OD/hg7aH8aGONit0jm82Qy2SQDqxu7lKplHjhapJv/mqWb7wV5MJyD5+/jGzX6LVchKIjpYllRSkUZ7h7f5Ibd9q02h0urZjk0ilMXwlF7Qt8spkYoWCXSr3JUbHL1rbGWCJDNFogGm4QjybRVEm3a1Gta9QafsJBQSzqkUxqmNsG9brF5raPXDrB5ITO+JhCJGKyvxeiUrUR6Di2Qc/S6Npdul2FdruH7ToEwj6mpiyeP18iGi7RaCXY2Jum3ZYUii003SPolxhaB+g+TYoJDw8VywpyVPCztmVRKNWJxFWWzoWIBBSKh20erfcoVsP07CzKhS4TRgdFsaBtI2SHkC556ZLD/EyYK5fG+K//I8D3v3/E44dr+AMh5udneO7SRdbWNtg4OmKnVKLQqMuOYzGfzIhIwN8vQHCcfhXPLyDkGVV5yM/hssUvqCc5ZdDiKc5Yfm4oJ8QZLbJ8EsSNlkvJM6Urp6tRxJBfHpTXtKweN3c3+evbN+Xj4iGqrrMwO0s8nuC4UOTg4D6RiMLv/PYs3/lOjtdetYmFDnC7NZy6h0BFNzTAw3EEnhRYlka15rKzf0yn65JKpNneSyEReFJnazfKcdHBcQWeB5Vyj51dhdnJKMFgjUjQJh4Hn0+j1uhSrXtUairjOZd4rMnkRILN/RDbOyXuPWgjiFGq5VB0i0q5xfpGle2tNkIaRAI6umphuYJWW6dR79CzXFQdfL46Ad8aQf82lj2GbRl0ux4eLrrPIBDw0HULgQtCOVUeJhQX4SlILCR9YzINjWQ0yMJUgqlxjdKUyY9/cszGZhNd9ZGMR0nFQ5h6DQUdhMCzbYRzTDJc5itfijEzk+DihSj/3/9+yCefFtjc3GJ6eprFxUUMw+Dw8JCfrD3kqF7hK8sX5AszsyIVjKAp6jCT+0S38bSs6BS9K88SueIZjJo4RR+foplPZSxB+zyx/JMvPAE23gi2lidlS8/UV4xicDnCfJz8wxtoNgSUmy0+2lrlh3dvyp1qhWw2y/jEGALB9s4OrWaNq8+n+K3fyvHVXzFYnC0QNKvQ6/W1FZpyclxvqAMyzQ7xRJmxXJhUMsz+fodiEdbW09QbeY4KJR6tliiWHCxXQQidbk+wfyzZ2Q+QToYI+CWpRJdIRKFa06jXNKpVDdeBaPiI+RmTYj1Psx3k6LjDz24cc+uRRFNVHEfF6gmCPp3z5yNcutghny8hXYWOlcZyQVEkPtMkFACfz0PVAVVgOZKuJUFo+E2dQEBi6A5CeCD1k5vpIoVEehquowJdolGHbNpge1tQLXY52G0TDobQdB9jYynKpTa1hkW5bNDpmESCGp6wEcJDEQpCVcH1ELLGbL7DP/udCEvnUvxffxbgr/7qkPv3HjA+lmN2dgG/38/a2hqrhWOOGnU2ikX5jQuXxLlcHstxcD2vzzePlGKJkRhMIM7Eap9DE4snuYxT9ZRneOrRwaCNHk0O9BlnqyAlT3vlkczfKV5ZjlQajGBmeULCe55E1/ra4o1Sge/duSGvb63Tk5LZ+TlymQz1Wp2d3UP8fnj77TTf+U6KL70qSYSOUWkjbQdPDrjQwW+caI4VgWF2iMeOmMyHmcplqZYFxUqT63f2EEJQrTYQQjKWSxGPRylXGhwdVanWHLZ2DWYnI0xONInFaiTiYXZ3JcVCk/19H80lP5nUEZP5VRxPEAnm2dpJcVx06XQ8dBUCAY9YVJLPecxMN5jIbxELF2i1Y4zlUrz4fIRaNU4m5RGLHKKqbaSnYll+2h2DZqNDt+mheIKA6eIzHRTR15P04ykHy1FodVK02jlcaeIP+ZmcsSjV4qw/rvDZ9V0ajRyLS2NMT0aJh1vgtkjGjlHoIJQeiuJhOf2azr4A0EMVHrrmEgu5vH41QCoRZn5hgT//s2Nu3zqgWmsxMZHltddeZWdvn831dd5//IC21ZOvzC3y8uy88Gk6HbvX56zF2YBvRH89LIwQp6tLRhV2ZwXVUoyWt5zmwoVAG/WvpzIvT/iQZ1X2fQHDPELjDUVGT5R5mqrQsnpsFgv8dO2hfPfBXRwBCzOzxONxisUSheMjshmNb34zz7e+FeTa8xY+vYrbbuN4fY8q1IFg3h0p6lROKiA8Ar4G6WSJqfE0mzsqu0cd7FobUw2Qy0RYnOsHXIbfZm1dodMW1Bo9dvdV9o99JFNdTL9FIh3A9Ct02g6uG6BnxwCDSLjI4oxCLm2zshCjXNFpdxQ01SUY6BKNdInFWoRCZfzGMZrSw2dYaKrGWCZBrxNAFTbxxD4+s4kQKroiSURtls+FyKajTI6pRCPHaFpvmFwYeA/LMTkqZVjbnKPe0AmELCJRHxcumqiKy+MHBe7fK2A5fi5dCnHuXIeIv0DMv0fQX8FxBb1ummYzQ7cXBAV8vh4BXw1DK6P3Ghj+LpeWXTLpLJP5Mf70zwTvvVdiexumpvKM5bKoSDa2tvnp2iMKjQau58qr0zMi4vPhSIn0PMRpRdHPyUyIU/GXcqZeZRR7nwYz/Xe1U8YpRtKNz5JrjhCM4kw1yZMpRD6tl6Vf8o+UVDptbu3t8N7Du/LR8QGm389UJoumG2xu79JqVrh0KcYffGeKX/8nJjPTZUSvil3zUFTjJOUrT2WTOHUbOKkucYlGakyM18hnw5TrPhTVYzKT5drVPBdXDgkH79KyBJ6XZ/fA5LjQ47josnsYYGLcj2F0GMsLls+FcG2PxTkIBSykB5oqiQSPCfjKxMMG9oSOREERCqqw0LQT7lj1TipEFEy9jt9o4cUUPMfA80DXemiGh+fpRINllmY1cpkcPSeOobWJR0ooavdk+nWHU6z0dOo1nQePVB48sshmNV56yc/keIVYRBDwxbl9q8766jY+f5hUssNkZp145BiBSqE0y97xBIf7OapVH57qEY72yCSq5LP7pBLHBNQGaq9Owt/lN7+ZYn5+nPF8jL/4b1vcun2L8fExpqYmAdjZ2eXx8QF/dr1H0+rKV2cXRMTvQxPqk7hr6KbFqYKOodr0qRrGp+tHn6kKHany0HgWiyxGhRbyVA3YGQrj1A/KMwKkwf6uJ1EVlWqnzY8f3ef99Udyq3iM6fMzMzON3+9nd3cfq9fg1Vcn+Zf/Ms83vmaTCB4gLAvpCDRdAyGfrmE8o6mVw34WLn6zRTpZZWY6xVExQbFUxHGaeLKEbmwTjz8m6kVod2Kk00l8wRBSUbB6Ply7RSLSZGFyl4l0BE1ziAYKhIKHGEod4fWpM11x0f02Qrgg+gEq4oSOEubJdNqPOYSUaMqJ4EG3wHP65+uqCDwC/jqGUSMR3cD2TBQUTMPC1Hv9Lwl3OOMKPFTFRhEWzXYP98ijUrKYyBUIBxxac2nq1QzrG0fs77UoH+so02Fsr0qllmVtY4l7DwI8XK1Srh/jCYtAQGEyH+XSynmWFvPkU6vEg0cYShddPWJlscP//C8TpDOz/MVf7LG2UQDpMTk5iW4YPHjwkN1Kmf96/RMOqhX59vmLYjKWAEXp4+ohsTDQfZyuYRSCoc7jNMIY5azFmUy1coorOV2CNaKqOiUmOqVflqerEZ7Sboy2xegLWwxVo9xu8f7qQ/7m3i151KgTDAaZmZ3F51M52N9HU7v8+q/l+d3fS/KlVzokwlU8u4XrgXvSF0N9RiG9fKp5waD0qV9REosXmZwYY3s7SLWk02j1OCy0KVchlxL49AbJaInz5zIE/RMoap3ZiUOSiR2iwRLx8B5CUdAMB0O3MQwN4YuCHgMi4Jlg63iehvQUHMdDuh6O62DbLo7dH2Ca1pe8qpqK0FSECqpiodBAKDZoDproYLo1glYD12rguh7SAekKbE9BKC6KqqIKgalJEhGHiaxgLa5RqrTZ37eZn0wTTwr8QT++oERRHayuoNsxaHeDtKxJHm9k+PSW4PGjAyqVDrruIxiKYHc9VtdsylWbSj3J1csCbcwjGjxApYep11lZhPjvx0jFx/iP/+chN2+XMAw/mXQSzzvHzs4OpVaTnzx+hJTINxeXxHwmi66o2K4D3olJKgMPLRgWMXK2S4A4nS0cshzPTn3/vfXQw0BvUDA5kr5+wuD1VViacmLMjx7yN/duyqNmg3w+z1g+T8+22VjfJxi0+eY3s/zzP4hx9fk2Aa2K027jSR1bxHFlBLwOOmVM3RvSV6Mp9CfAwxueiaa5hAJVcukC42M6mzsGxXKDew9VMukok/lpjOgGseAOy7MmM/kYml4iGt4jFmngDxjgC4DqA2ng9Xw0W34aFYN606BZN6lVXQ4POxQrLXonha6e42A7DlbPxrX7mVRN1zBNHd3QUXQVVdMI+BUScYVsOkwsquDz2USCcWJxCIcFhumC0gG3DnYT7A5Or9NvMoNHNFJjdqpFpZni7kOTrd0eVk8lEhNUak22tlq0u5JUyk8wotG1TIrlMHfum9x/WKbVbJDLxlmYi5HLqTiWzc6ey8ZOh5u3PYJmjLBvDL/ZwKfYSFsilDqT4x6/+etRVD3Lf/5Tlc+uH9BudRgbzxAIBPpGXSrx/uOHOK4rEUIsZLLoqtovIJBypDJGDkVWo2b9i3PP3qnvaDyDhxbPKir7AoHSqaruE0Mb0CvVTov3Hz/qe+Zmk/GxMeZnZ2l3e+zvbaPrNr/5mxP8qz+Kc2G5gior2B2J6wVotKIUanO0Whl8RpVMcpVE5BhNc0FqT3C/fHJLhBgErSoCgal3ScSOmRiPkM2HqTV7dHsKrU6Adi9CXHqEAmUM/SGe1NB1D93QEUqOnhujWw7RbAUolFV2dx02Njvs7TQoHLcplbqUSw0ODqtUGh08TzxJ5Mp+56T+tCWGWobRqF3XBfGIj3wuQjzmIxhQyKQNpucSTM8myOd9ZDMOkVAN02igK210ow40kbJLUJQZH19FMTwCwQi370nWdps4mx6u7eI6knQ6zrlzKvmxDrYrOTgw2Nnu0Wl5ZFNJrj4X5crlBrlsGccy2NrO4Toeaxtt7j9wGMuFSSeCmEYVVahI18Hu1MgkLX7j12JEojn+9/+o8JP3izjbNjMzM0xNTeK4DrVanY83N0AI6UkpFtMZVE1Det6p9hXirDZDnK6QemYl+BmOb7CX9iz98ygqfiqRIk6PpNOp7P700cfM2okxP+Cv7tySx4064xMTTE6Ms3+4z97eAVOTEX77tyb5n74T4MK5KrhlpATb9lFt5Njcn+HhWpqtHYdcOskrL6poeoNIsIEq9D6NJQfVxV4fasgBSAWkg656RAIVxrM1lhcT+H05UmmdpcUamlJFugLFCOA3/SAiOF6cajvE0ZGP9XWPO7er3LmzxcZ2hUKpQ6ncptt10DQdw/ChazqGGWZycpZkMoffb6KqCoauYvqMYSGslBLXdun1LFzHpdvrUqmUKBaLPFit4TglbNvCcR38hkosGiSdiTI9HWblXJSFhRizcxMsLZnEIyXwdtCVAonENgFfiWRojLmJCfaKMY6LGq0W+A2NfFYwO7lOLF7m8DjBQdGj3rQIBXTmpoNcWqmwMHWfUOgI20rQ6zhkMgm29lQKlTbFika360MEzX6MILz+JbltkmGXr7yZIJGeIZ4I8l//fJ1799rMzc2wMD/H2vomtWqVD9dX8aQnpfTEYiaHruq4I+ny0b54Z1vZnPLkI63Lhn0/BrEcfc22Jj63H8dTfWL6nO9Tuw2KAvqfOJ6HoWmUmi3eX33A9+/dkceNOsFQiFQiTq/X5fCwRCql83u/N8EffMdkaa6AsKu4jsATKo5rUm9kWV3P87OPOxSqVUo1P8FgCr9/AdNYw1BaqIralyJKiSM9HJeTvnQqmjpoiwWG0SOZKnL5vI+lWR8BX5VkbI9EvEcwOgVagmotxO6uzsOHNtdvFLh1+4DN9QoHR01aTQtVN4nHM8wvrJBOp8jnskxNjZPJpohFo8TjCaLRGIbRL6JVFNGv+BBP5i/Pkzi2iyc9bNuiXm9QLFYoVypUahWOCgX2dw/Y3dvlcP+AO/cLfHZzm+/7FZLJIDNzWV64OslzV6KcW1xgenKKRKyCP1wiFDoiGq0wkQ/SbIdwnCCGJggGGkRCx1h2gO2On1pdxZUK6bSPmVmF8bEDYuEyhtrDEk2i4Tozk3nK5QQ9u40ibDxUUF1c4eDaGq5UUBQHXbeJB6u8ckXF/U6QXjvHX/3VAevrW8zPTzE5MUG9VqPe7XB9exOklEIIsZTLo2kKtuOiCjHUd4untPbiKbmoECOFAIjTVTSeRBvt4SieURUgEM9knc++48l+rzhNVSk2mvxk7SE/uHdbHtSqRCIRxsfG6PYciqUi6YzO7/zTLN/5XYOluSrSqdLruRi6gSJcFLWDpncwTQtVc3Fsi70Dh9u6STw+i246pKJr+LU2Ugpsz0erl6bRSSBwCBklQoEqutaHJaoiiQYPMfUShh7E7zPRzSiWk2BjO8q9Rz1u3ipx63aJhw9K7O7WsS2IxqMsLs8xNTXO1OQEMzNzzM0ukkr3jTiZTBCNhlHVf1iLQMdxaHXb1GpVKqUy+8cHbG1usbG6zsbGNjtbO+wfHvLRR3t8en2XfD7E8kqa55/L8sKVLMtLE2QzLRK5Y+LWMZZ1iOcoCCkRoodQJW5zHA9wpUBTdSJhnUTKJhAsoqo9PAwEkkiwyNJsAJ85QbtrkM+28BkNHOnQ6SapN6ZxHJ1A8JBw+ACDNqbS4dUX0giyuI7GD/52l729Q6amJpidnWV/b49Kq8Wn25uoiiJVgZhPZ1GF8kQz1Od2+5hYKiNm6J2W4HkjjMiwb+HJRCjkCcsxLLFi2F9BPlPO1HfxcqTFbT/J5J0YNTS7HT7YeMz3792WB7UKwWCQyYkJFFWnWCyQTMBv/EaOP/iOn4WZIl6vheeq6JoOwj1hJ1rEYzssLgZodfPgRtnZa7C91+bG3QhmYApzoY2qbqJ4BvXWGJv7i+wcZlBEh+n8NjPjgrC/jKo6KMIl6PcIhhRcYeB4sxwUMly/afOjd/b42U9WWV/fp9XtEfCHWFhY4vnnnufSlctcuLDE2HieeDxBOBzG0M1nBMgeUnrDRJIY6SLR72066nWUU4J3RYCqKkRDYaKhCFPjU1zhOVzPoVarcXxcYHdnj0ePH3Hr1i1u37zNxuYm3/vuI9770SbnFsd55eUFXn99jMuX02RTKQKBfYRXQjotpOfieKBoXXyhFuFwGIV+oqjbEXR7MZo9gdXzIT0Nv1pjYuwRyUwBy46jiQ4+vU2rmWb3eIXV7RksS2N8LMTstE0qeoyQHcL+Oq9cNbDtHKqm8P5PChwdFcnn8yhCsL29TbXd5qONNaSUUkrEuWz+BLZ6w04CQpyVJj2jCc6ZynM54r21Yf+zIY8s+typ4FRvZsnpmsDTvej6HS+r7RafbK3z49UH8qBWIRAIMjc/jwAOD/dJxCXf+fYUv/vtEOfmK6iyBcJFHZajawihoAmPoL/OWHqLzrxBo56h0xOUag0ebQqikRAhYwI7a6MQ4OB4ig8/i3Drfo1gQPLGy2nSiS6mWsTnc5HSh9BzSHWWQinLZzcdfvDDdd57f5W1tUNc22NifIK3nrvCc8+9wEsvvcj8/ByxWJRgMIimaZ8bEntev0xMESpSeEhvtIRfGZF6juqDn04GneVYVUUjEU+SiCdZXFjk1VdfoVQus/Z4nZu3bvHxx59w88YN7tzZ4+7dbd59L8vrr83y+mspnn9ukfFcGlPbx+sdI1wbQ7VJhruMZVW2NgWFUpfV9TCh4AViYWg2A+AJJjJb5HJ3SUS3cOU+dtek205wWJzn1oM8H9+oYVmCSysRAsYsAdUmElCQnk04WOLNN1QUNYeUgnfeOWDXdZmYmEDXDe4/eEC10+Fn62uYui5jwaBIh0LDFhWDxgmI/r8HctJR41UU+aT/B31oN4gDhTjRcsgRTDKarhaj731OutvzPFRVxXE9dspFPtpYlVvlIoFgkFQyhUCyf3CEKlp85c1xvv07flYWqwinhOt4OI6OdDQELkKz0fS+IeiqQzRUYmJMp2eH6Nghbt7pUqu1uHnHRVOyWO4Mnbbk3v02129XabQlyXNhfGYH163iCQfFSCKMRY6O83zwscsP3t3kww9WefRoB8eRLJ5b5M0vfYnX33iN8ysrZLM54vH4M41YnjQld91+cNdsNqjX67iuSzgcIplM4ff7n9L4flF95uelg13X7T8wtd/qNxgMEgwGmRgf58pzl/n617/Gw8eP+OiTT/ngg0+4d/s29+69x9/8dZQXr07yq9+Y4Stffo78RBVaj3EbxyRC+yxOJajUsty82+TjTyvs7AaJRg063RaaInhuOcWL6jiTY1UEHVrtFDuHy9y6n+b67Qb7u1UEOql4nGolgZ1KgL+NJ7soTpuQXuKVlwSdXoxux+Kddw9wXZidneDChQs8fPCAZq/Lx5sbxAIB+WsXL4uQ6aNj9VDUvmJtoD8S0hv22hWD3tYnAaRy8rdQODH9oR5afnEzLilPccziDMZWlT49tlE85keP7svV4yM8T5LP5YjHE2zvbOG5Ld56K8/vfivF0lwDxSvR7bk4XpxaLUezFQPFIxRuEApUMPUmmtJGV1skwnu4E0G63QW67Qj3HlQpHDW4+9BPpRaj3uiws9PA81wunw/x/CWLuak94okegcgi1foYD29E+dt3jvjLv3rEnbtHCEVlaek8r776Il964w2uXn2JqemZfnp+aFAOrVaHdquDUCAcDhEIBBBC0Gq1KBQKHB0dcXR0RLlcxvM8QqEQwWCQUChEKBRC0zSsnkW1VgUgFosRDAZRFGU4MLwT/KgoCn6/n3g8TjKZxDCMUxi739m0b9yJRJxEIs758ytce+UaX/nyA95//6e8++673L1zh//rz29z736Rew+WeOPNJC9cXCGTiJPyl3G8TWwPNCXB/QeC/b0eG9stPByiYT+5VJpqPUkylsF2NDb3lvj0VoZb99sUihUCPkE+62d22iEeK+PzNVCUXt+kXIHrdAn7j3nj1Ri9boxOp8cHHxY5LgSYmBijWEhSLBU4btT5cH2NdCgkX5yeESHDxHZcFEU56VvoDZN9QpzYmaKgir5XVoQyXEVBEQJFOfHQ8gu6iz7ll0ew9YAjlFKyV63w3qP7fLC+ihSCTDpNJBI5oai6vPZqlj/8wwmuvdRGpYrTc3BknOPKFOubs2zuhnGkJJvukUuXSMcKxCMlgv4ahmoTC+ywMKVi9aZp1ELs7kuO9osc7FXwgEjEx8XlMC9esZifLhJPuqBO83gzwfs/7vC9v7zBzz5ap21JVlbO8frrr/OVr/wKL710lWw2108kexLHcbCsLpVKhXK5SrdrIaQgEPQPe1B0Oh0KhQI7Oztsb2+zu7vL/v4+h4eHVKv9/s6BQIBkMkksFkNKSbVaxfM8YrEYoVAIz/OwLAvHcXBORPF+v59EIsH4+DjLy8vMzMwQj8fx+/2nZgvPc0dklwpjmRz5r+a49tKLfOPrb/E3P/g+7/7tD7h39x7/j//n+7zzTpbf+87zfPPrS4zlDkhlj1C0VZKRCeYmxrn7UOewqCIUSTqpMTnRwPT1qLcmOChkuHknws1bNY6Oq4RDGtOTMZ677OP80gG51CMCgQKO58NzEqiKg6o1kU6bWMDhS69Fcewc7bbH/QdFTFMnmUrR7rSp1+vsVyt8984tNAHXpudOWhx4w4yzoohhU3pVEeh6v1eIUJQTJZ9AU9S+11b6+6t/cO21p1PfQo6sTCBOrU4w6GCkKAqulBw36vz40QN+svpQtqwesXicxcUFOh2Lzc01rlyK8S//aIK3vuwS9h0gvB62rVGtj/FoY5aPrut8cqPM6nqZowMolSK0W3EsN4ErY0hPQ1EsdKOJpgukkqFc1ajW2ugapFMhrj6X5sUrHWanNojFXSxnks9uxviP/2mLf/8fPuGTz7aIxXP8k3/yG/zrf/Ov+d1vf4tLFy8QjYb7Ncon/GSzWefx48e8996P+fDDjygWi5g+g0gkDEC5XGZ3d3fonTc3N9nY2ODo6IharUa1WqVWq1Gv12m320M45vP5UBSFRqPB/v4+m5ubbG9vc3BwwNHREYVCgXq9TqVSYXt7m0ePHrGxsUG9XscwjCGO97yB0EsMez4Pe0ubJrl8lgvLyywuLOL3BTk+qrC+vsf9e4ccHkpMf4rsWJxorI3P2CcarjE+7mNhNsDKIpw/V2Esv4um2+wfTXLrdpobt0tUKxUU4REKhFmYyzE/b5HLrhPwHeDYBuXqLMXqHJ1eEEQdQ+uhqhLT8IjFNDpdP9s7DqVym1A4jAK0Wi16tk2r26XnOH8c8/v/ZCKR6K9XIwS6rmEaGqaho+sahqGj6/1/a1p/GQ9NVVFU0X+dQBD1D669fqqqQD6jRlye0XZ4UqKqCl3b5vbuNj96dE8e1Kv4fT7yuRwSydFRkUxK8i/+cIzf+Cak4sd4VgPX1uhZcbZ2p/n4Zoq7D5t02i4+3aTVhr39Fpt7NvuHfkqlJO1uFpcEQhPomotp+Gi3g/ScALlcgKuXNa6sbHFuoUgyk2BnL8p/++91/t//7g4/fOcxrhPgzS99hT/8w3/O7377n/LKK1eJx+OoJ17P9Vyk9KjVaty5c5t33vlbbt++S61WOwn4+jei2Wyyv7/PxsYGh4eHVCoV6vU6nU5naLjhcJipqSnm5+eZn59nYmKCSCSC3+/HMAxs26ZYLFKr1XBdF1VVEUKczAx9j93pdCiVSmxvb7O5ucnR0RGWZWGaJj6fia7rJ4zKaWW8EAJV6Z/D5OQki4uLTE1Ooig66+t7XL+5zuZmF9dLk8tOksnphPyHxIM7ZBMH5DIHhMNlXM/P5vYYn90McvdBjUK5hqppaL4AUqigCCIhQSTSwxOSSm2Gu48WuPs4RaWpo5vgMy1ULEzNIxyCcDRKqSp4+KiG40A2l8XQDSqVCo7nYTkuQb/vjyeSiT+JBoP4TBND19F1FV1XhwY8gBfiTBObJ6oe2TdoD4l4hnRP8mQFJzmiHtVVBcf1eHR0wN/cvy3Xjo7QDJ3xsTEikQiHB0doWo9f/7UJ/tnvmkxPVPB6dXAVPNfAcQMcl1M83giys9ciGgpy/twcY2NpHLdDodzguNijWJaUKj6q5QiNRoRuN4AQJj5fmGQiwNxMi8srRyzMldH9Ue6vZvmzPy/y7/63j7n+2RbTM4v8/h/8M/7oj/6Qt976MjMzU31P57o4nnuygpWKbVvs7e1y+/ZtHj16RK9nEYlE8Pl89Ho9Wq0WrVaLRqNBtVqlUqnQarVwXRefz0c8HmdiYoKVlRUuXrzI4uIiyWQSTdP6HHOrNfTAtVoN27ZPvI3+VMA52CzLotFoUCqVODg44PDwENu2SaVSQ48/wNWjBRWe56HrOqlUksXFBWZmZgiFAxwcFbl1a4u1tQadbohwJEMi4SccrKMr++DVaHcjbO4s8NGnMT67XaFSqxIOhZmbHWN8IoknJPu7ZZoND12P03PzbOymuH5X4c7DDuWqQiiQIhaW+M06umKjKC7xhInhC3F0KNjcqKJqBolkDNeVtFrN/mJLto2mqn98ZWrqT6KBAJbjnCzaNBIQDlQfo2pQnijiBKD+/rXXTq9DMWrMZ8T/gxuvKILtSokf3L/NhxurfyyRjOXzTExO0mw2sawGr7wc4/e/k+TySg1dq+M5Ak3V+tyJ4uFJk1Y7TKGk4bkG4+NJls6lSGdcIiENPKg3GxSKdY4OHA4OTEq1CFILk894LEwVmJk8IJ3tIfQJPvw0yv/671b57nfvU61ZvPTyNf7oj/4F3/nO73Hh4gqmqeN5Tl8grihoioYQAsuyKBQKbGxssL29TblcGeJa13WHXnhguKFQ6MRLSnRdJxwOk06nGR8fJ5/PEwgEsCyLcrlMoVCgUqkMjbJYLNLr9YaG1+126Xa7w5lvgKkBDMNA13Usy2J/f5+HDx+yv7+Pruskk0mCweBTy7uNLuPmSQ+f6WNsPM/CwgL5XJaeZbG2tsXN2+scHDj4fDly4xMEAhqu5dJqRdk9SPNoXXBwbBEIBFhZTHHtOZ3lRRu/T1KpuBwXu7TbfuqNOOubXbZ2StRqLUzdx1g6RDbVJhwqoWr9azV0STIRwDAirG/0WNsoYPpMsukU5VKZrmVRabVoWz0Ws5k/SYWDJ6uIyaETHl0GTigDGCyHM+iAtlN//6VXn9RvDZZMEKdlz4MK7cGPlFtNfraxynuP7suubROPx5mcnEZVVY6P91hc8PGd38vy9pcdQv4yOBZCaP12TYpAUR0UReC4YerNBMeFHp12hXC4SSrbIpdNo4kk9YaLZVlYTo96u0fXlmTTJtNj+4ynH5OICbpynh//LMz/63+9x/e+ewPTH+I3f+s3+df/6t/wtbfeJpfLjfQ17gcUnDx427YpFI7Z2Nhke3uH7e0tHj16yOHh0UlS45hCoYDneeRyOebm5hgbGyORSBAIBAgEAoRCIUzTxPM8KpUKu7u7HB4eUq/X6fV6tNttWq0W3W4XAJ/Ph2ma/cWBLKvPFJ1MpwOHMZgVms0mzWaTbrdLo9Fgd3eXhw8foqrqcPA81bP55NqUkyycIhQi4Qjnzp1jaXkJ13VZfbzJZ5+tsn/QIR7PMT6exu9v4zrHCMXFlXEQGbKZINdesFiZv08y9pBgCHRzgkpFsLdfplBoUK21sXsumUSIKysBls8VyKY3CPhr6Fq/sEF6NqGQRzzuw7LCPH7U4ui4id9voGk6vUGA7HmUms0/nkzE/2QqEafn2Gfzev1mOyceV5xIDE54vX4b4H927dUnnUGHAn451PafqkIRfd75wdEhP350X+5Uyui6zuzMDIqqs7u3TSop+fa3c/zmN3XSsWOka9O1NGxHRUoPTem3m+1jHj9dO0mhCOVKG11TicczdDsqa5slapUeY/k4MzMpMqk44xmFC8sFZqfWiSYk1Waed98T/G//4TY/+eljxsan+c53fo9/8c//OS+++BKhcGikF6U49bIsi0qlwtHRMY1Gg1qtxvb2DhsbG1SrNTqdDrVajVarheM4+P3+IQxRFAVFUdC0vpd33f7Aa7fbJzNU/wEN/t/r9dB1nVgsRiKRIBqNoigKjuOgaRo+n2/o9UchTq/Xw3EcbNseHr9SqXBwcICiKExPTxMKhYZw42xb2uEiPEJgGAb5XI7JiUnS6QylSpPbt9fY3DjGtTVy+SiZvEDTSvhNm7FsgIXZLrNTa2QSq/gDFTxh0nGy1GpBatUOrVYdhCSdiHLpfJCrz1eYnX5APLqHqTt9ByL7GWpFcQkEJGbIZP9QsrrWwHEcJiencB2HWr1+spxel2jA/8fpUPhPfJqGerKOpRhKRJ+1IIsYfq7+/rVXT5e6CHFGDtpnBLUTQF5s1HnnwT3u7O/8sRSCUDhMKpmgWK5Rrx/z1bey/LPfjbG00KLXqtLq+qnUp6i3JrHdIIIeitpFUR1AYDs+qg0fxQo0G5JeO8D6ZonjYoVc1sfV5zUurFjMTbZZmKlwbv6ATFZwXE7zP75r8e///V0+/miNpeUl/s3/7d/w7W//DkvnllBVtZ+cEOKZr1KpxObmJvV6/cSYt1ldXeXo6Iher0en0xkao+d5GIYxDO663S6WZaGetJu1bRvbtpFSDg1USkmtVqPRaKCqKvF4nHQ6TTweH3pWXddJp9NMTk4Sj8fxPO/UIBrw1I7jDDOSqqpSLpdpt9skk0mmpqaGnPVZox5dwdXz+ng7k8kwMzNDMpWkVKnx8Se32VgvYvpS5MamyOXCRIIVEpF98pkjwoFtFMXCcnIcFid5+Nhkb69Hs9FGVQT5bJSLFwJcvlRgduoe0egeumLhSQ1XgsRCYVBXKDF8AkULsb/vsbXZwO8PEA4H6fX6A9aVHo1ul3gg+CcXxsdObNN9kiMYWT1gmHUdBoonBj3IBj67IXU/K62qCo1Oh0+3Nnjn0T1ZbbcJh8Jks1nanS71eo2V5RDf+U6Kl1/oYehVrI5BqT7JxvYKm3vzNNpRNM3GZ9bRjTaKInE9jXY3RqVqUiw0aNSa2LbD5HiIl16ECytbjOXukU5skE1X8QcMjgop/vK7Hf79f3jA/Qclllcu8a/+1f/Mt7/1O4zl83ieNzSAp72WR7lc5u7duzx69IhGo8H29ja3bt1iY2ODRqMx9IpSSoLBIIlEgmw2SzKZxOfzDQNEy7JwXXe4AM9on8ButztkM8LhMKlUash4DHByOp1mbm6O+fl5QqEQtVqNw8NDms3mqSBvyC6NJGEGUCaRSJBKpTAM48nybc9ohzwaOPp8PsYnxkmlUxwXijxe3WF7q4PtpBmfmCedsvGp6+jiGKEIKo1xtvaWuf9wnJu3bLZ3i3iew0Q+yvMXfFy5VGVyfB+f0aHbi1Opj1FrZulaUTx8aCpoitOXOQiPWDxI1zJZfdzl8LBCIpEgGPRTKhb7vb9bLcKm+cdLudyfBExj2DZjsHLXcHmagfR02CbhBEM/WSBx0KJJDJcLHhDcbcvi3v4u7zy8y1ap+MdCUUkkEuTzeUqlCsGgy7d+Z4rf/CeCXLqI3e3S6uTZ3F3mg09DfHKjR60uSCQCxMMtTK2GqgukYmK7Kap1H6VSC9fpMplPc/Gin8X5TfLph0SDx0RCHpoWZWcvw5/+WYX/8H/cY3e/w4svXuNf/es/4pvf/CaZdOpJn+IRYx4Ym+u6FIslPvroI95//33W19epVqvs7Oywvr4+9M4AmqYRjUaZmZlhfn6eyclJYrEYjuMMA70BTh7s73kezWaTSqVCpVLBtm2CwSCRSIRQKITf70dVVSzLwu/3MzU1xeTkJMFgkHK5zPr6Ont7e1iWhc/nw+/3D1Pefr8fXdeHWcMBJKrVaqiqOsxCnvXOnFkqou/lFULBILlshng8TKVS4/6DHba2anQthbGxCLmUi2fXafdi7BbOcetehus3WuwfNbFdwfhYlKvP6VxaLpBJHGDbAQ5Ly6xuLPBwfZat3UlKpXE63QxIFVVto6ltDMPCHwLTF6DeMlldq+M4CoGgD9t26HW7/YDZcXCl/JNz2SxB06RnO6gnz3S0N4c4KeoeXK82Wr7yZGEfOVSaSlwEKpVWi/sH+6wVjqUnIZdJk0plqDcaCBxeeiHL176aYCy3g+c2sawER0cp3v9Jne+/u87hcYdzC0kmcnGmc35iYR+q8Aj4a6Tiu0TCKTqdJttbx7Q6XXKTac6rXTTRRZEKQpukXJngr/+myv/5n++zudPkS2++yR/90b/krbe+SiKRfLqz5ZmH2+l0WF1d5f333+fTTz/FdV38fj+9Xo9qtUq73X5qyh54aNM0aTabJ4FkAcuySCaTQyMbBH2WZdHr9ej1ekNYYZomqqoOF6ePRCLEYjHy+TyGYVAqlYYBKMDk5CQzMzNkMhlisdiQcWk0Guzs7AyDzlarxfXr12m327Tbbd5++21SqdTQm3+RxwZIJBK8/bW3CQXDBAP/hXfeeY//+hfXCYeWCX4rzXimd6KGbFFv1VnbKLKzW+TC+WmuXvFzfqVANFqnUInx2U0/H39WYO9oj1rTwXMgaKqMjem8+lKMV16YZ2pslWCofFKbGOLN10N88DMfe3t1YrEAuVyWUqmEBI4aDe7s7cqr01Pi/FgeVShPd8kV4ilJxi8k5LUch51KifsHe7J9QvKn0v3+zOvrj5md03n76yHOLzdQaNFumxTLOW7e9vE333/ER9fX+1SYnGBjbZYXL+mIbATpVjHUFrHIPmMZgd8v2dze47hYZemcpNc1gDiKHqVSX+b9D23+7L/fZG2rwdWXXuQP/qd/xte+9hbxeGKYbBjVY4xutm2zs7PDxx9/zL179zg8PDw1nXc6nVP0meu6tNttjo+P0TRtyCs3Gg0KhQKBQICxsTFCoRDdbpdCoTBMxti2jeM4+Hw+gsEggUAAwzBQVRXDMIb/LxaLtFot9vf3WV9fx3Vdzp07xwsvvMDFixfJZDL9JNBJPNBqtdjb2xtmGavVKt1uF9d1efjwIaFQiHPnzjE+Pk4oFPrCNUwGBh+LJfjSl34FgYbr2vzgb/4H/+k/3cBvPsc//e0pUvEjctYBc+M9Lp4PEwmFePmyxQsrB/jDNbb2dX70nscPfrjO3Xsb1BptNM3A0Pz9KndDsro6RqsxzTe/tsSEtopBmVioyZWLGm+8nubP/2KXw8Mi4/kM6XSaWrWKZdtsFot8uL4u0+GQmIgn6Dl2X3z7rOs5MWrtbLvxAYfXZzz6xYzlVp2HhwfsVEoARKORfgeiSgVF9HjxaphXX7aIBKs4PYVKdYLP7oT54XtVdvbbJBJJLKtDuVxjd7dOtR7Hww+yjHQ1VPwk4wnmZk2mp2sE/R75dI+w30VoSUrNGd7/QOU//+k91jYbvPDSK/zhv/gDvvLVt4jF4sOHoyjimQo5IQSNRoP79+/z0Ucfsbu7i23bQ086wKYDnDkIJnu9HqVSaYiHA4EA1WqVXq+HYRhYlkW1Wh1m+Or1+hB+6LqOYRhD72rbNpqmoWkanU6Hzc1Ndnd3hzy367osLi7y/PPPc+3aNaampjBNE9M0h4PU8zyWlpaGCZdSqUSr1cK2bZrNJg8fPmR3d5dz585x4cKFU5Tls720xHE8fD6Tay9fpdtrUa+X+Mn7P+E//KfH+ILP8du/OUk2s8Hz5ytk02HqjTT51BGpRI3NgzA/+rHGn/3FY+7cWcfQBWPZOHMzadLJEO1Oj+3dCnfubaDrkM6exx/MkzF6aLLBZF7lG19PcPtOgI8/rhAJ+8nn81i9Ht1ej4NanU+3tzmXy5IIhfrreA8Ec4pyusbwRFukPWEyzsiSTlKHXdtmvXDM46MD2XMcdF0nGomcUEgFlpcCvP5yiNl8F5wezVaOzd1J3nm/xkfXd5iaHuPS5WXW13f5+KOPKZQ7VKtJeo6GqkrarShbW1Ps7E4Si0f5rd+eIJfc4rkLW+RyNs1elp9+1OPf/8f7fPDBGivnz/NH//KP+LVvfpN0MvkES4kvrhOu1+tsb2+zsbHB8fHx0NAGBjzIup2ViQ4ycsVicUifRSIRXNfl8PCQ/f19FEXB5/ORTqeHMGOQIRxQbIFAgEgkgqqqHB4esrq6yvHxMVJKkskkKysrXLt2jStXrjA2NjbE24MZY4B/Bzx2Mpkc0oUDyLS6usq9e/eG8cBXvvKVoVE/iwGRElS1XwYSi0V59dVXcT0X23H48MOP+M//5THx6EW+/pVpcvlNwqHHIIOoRotqU+fxmsZ77x2x+ngfv6lx6dIiX/3qPK+85Gc879BoKty4JfnP/+U29x4c8v13fExNx0kkQmhOjYDZ5NKyyZffTHB87FGvNzGMQH9xqBMXu1Mu89HmpsxEImIpmztZLNR76pkPln/TBs08pHfaq6mqguW4bJYK3NjdZrtUQEBfRRaPUy5XCQQ8XnopwZVLKoFQnVbN5PA4wQefOPzsw0Ns1+Wll6ZYOpekVj1E100aTZtSBbqdAD5/gnJlkvd/JvjJR/eJJxP86tsLXFh0Gcu1MIIp7q6G+e///THv//gRE5NzfOc7v88/+dVvkE6lPjcAetbUOkhO9Ho9LMsaGuoXvQbT/MCgLMui2+0OIUmhUBhiZ7/fTyAQGCZKXNel0+mgKAqRSATHcYZp893dXcrlcj+LZhiEw2HOnz/P1atXyefzz0yJj8pHBwNPVVU0TTvRefiGmpOPP/6Y9957D8dx+MY3vkE2m/25S6gpikI6neH119+gUq3QaHW4dfs+f/HnBhPZS7z60gTh8G3w9nDRaXdzbO27rK0f0+s5XHtxht/51iJfedNmdnKTgK9DpxdEVWPcuh1ma7fOg8dF1tZCLM8YBKMaUnikk11+5fUk6+uSd97txyYTE5MYho/DwwOq7TZ3dvdYymRZSGdQ1P4y00+kpWKo+nyqt90TRR0oUtLqdVgvHLN6fCQ7jkMwECCVSmLbLq7b49xihC+9FmZyrInrCMq1FJ/e1Pnrv9nm+KjJG6+N8cpLHqHgPqFAA8MwaDZcjo4cqrUYRsfHpzfD/PBHO2xs13jzDZtM0iOf28cX9LO9F+eHP6zys5/uEAon+PXf+HW+8Y1vkElnhg954MU+D2qoqkqr1WJnZ4ednR3a7fbQSAbHGKXFRg16MJUPWImBATWbTdrt9pD/HVCEuq4/ibY1baiN7nQ6VCoVms0m1WqVRqOB67pDJd1A0JROpzEM45SmY3ANo01/nJG1ugcvTdPIZrMsLy+zt7fHBx98wN/+7d+SzWZ54403CAQCX2DQ/ZbCiqKQSCR5+2tvUyxV+N//XZWPP9nle99LkUyMMzudRchHSEfD6fpo1fvp+1gsyAvPp/jSazaLs+v4tCOkdFDVOKGQSSxmoqkK5VKb/d0u7aaOiPuRXhdTb7FyPsJLL/q5ddukXGkTicSIRiMcHOwjJRxW6zw6OpKXJyfERDyOqpy0FxNP95FWBvoOMdLwQFGga9scVCpsloqUW00URSEWj+Pz+ahUKuh6l2svJnj+MoRDbWzLo9MzKVcUXEfjwnKOr30lzfLCLuPZHXIpD5+hUa1aHBUku8dpPruX4C//usCjtRJLi2HeetPH5Ngq/pBHoTLGD3/Q4XvfXcWyTb729tv86je/yVg+i+cN6ETl5wa0vV5vqJI7OjoayjpPrSjwBR56wEkP9B2maSKEoN1uD2Wi3W6XXq+HbdtDgxkYOECpVGJ9fZ3NzU3K5fJwv3g8zsrKCpcvX2ZsbGyYeRxkIke958AzeyM9Lc4ap2maZLNZpqeniUQiHBwccP36dY6Pj7+Q7WBkqTZVURjLT/D1t97mV3/111H1OH/9w3W++/0Sh8U8QsujaSY6DgFTIeD3EQ75SCQgEWti6g1UTUVqKVqdLIcHMQ4OHBr1Fq7l4djgSvWEj/BQ6JCM17h8Cc4vh+j1OpTLFaAvshJAx7J4cHjIjZ1deraNriin8iZnWA5xUkx7QuRLiaYqNLtdVgvHrBePZNvqEQwGCYfD2LaD63WYnzN59eUgmWwHIVw81yYYrPL8lTiB4DKmYfPcxRKp2DFOL0wmHiYU0CmU6hyVVe6vBXi0eswn1zeJhAO8+VqMq1capJM9up1JPvo4yH/7y1W29lo899w1fu3XvsHlSysYhtFnM8Tnd9cZPHDbttnb2+Px48fDoG5gZGeN9+yDHvDYo8Y1mPY1TUNRFGzbHkKOQep68NujiRXLsoaJmoFx5vN5rl27xuuvv86FCxdIpVJDgz7bq2/0NYBQz7rmAfSZnJxkfn5+OJiPj4+ZnZ39OUb95P+apnDhwgV+67d+g/2DA37607/lf/z1BpmxS/za15eI+tYIBJrk8zHG8lG2dmscFiyKpQTxSALFcKg0czx4GOcHP2zw2WeHdDsOsdkkybSB6Wv0e1yjgethqB2W5yJcezHEhx8d0253SWfCpNIpCkfH2K7LVqnMnd09+eL0tIj4fMMmMWcvSZOnlvURePSn4ka3y0GtynG9jlAVwqEQtm1Tr9fx+x0uXIixvASm2sbq+YAw0bDN8rl1pifjqEIQCZTwmV26Ikg8qRKP+1nfgaPDHtevF3m4WgBF49VXxnjlJT/JZBHVDHHnjspffm+TG7f2mZxa4bd/+zf50huvEz4pqOyrsMTPbVfWbDbZ3Nzk8ePH7O7uDmm1USHP2b59Q3HPiEGPYtXBQBloOwYDpNPpDD21ZVlYlnXKm5qmSSwWI5fLMTMzw3PPPcfVq1eZnZ0dCvjPBm9nz+0sJHrWgJRSEovFmJ2dHV7vIPupjqwM+0Xsh5QS0zR47solfus3/gnbW4+4fv0B42MJzi9f5OK5Ev7wNlOTUS5cGGNru8FP398nl05SvrYIQnL3YY+PPtrns+sb7OwUiUTiLC5mWVgMEAqVcd0uoILQwfOIxbosnfczM+fn5o0GUoaZnZulXq/hNNu0ez3WCwVu7uwS8pnE/H5cTyK9k6Sg0m/boI1WcQvRb4jYsXrsVEpsFI/p2TaqrhMKBdAMg2KxwOSEweWLCuNjDVwXdrazHBWTmIEOM5N1xjNlhFdHKF1AR/EcwjFIpnwgPR48WGN37wgh4MXnx/jqr5jMzZTQdYV6e5wPPunysw+30LQgX37zTb78K2+SSqZwPe9k7elfoOOZ51Gv19nb22N9fZ1Hjx6xs7MzzOx9kZca3VRVxTRNotHoUFik6zqBQIB4PE4wGBxmCBuNBs1m81RqfAAFotEoY2NjnDt3jvn5eaampk4V4w5mgs/zvs96DZgYIcRwoNq2DTCsbywWi0POOjUSSH9+h9onKfJwOMS1a1f5xttvc3hY4Kc/ecTli0kyiQypRI/pqQ6vXguyuZXlk0+2+D/+z9t8/GkWRVHY3CyysXFMt9ckGo3y6sszfO0rCRZmKvh9FRBdhNvvfiUdD11tMD3l8OqrITbWm1TKTcLhEKZh0lW7eJ7ksFbj8dERlyfHSYdC2K79JO09XNaN04s3S09S63RYLxbYLpekBPw+H4bpRzdNfD6V5XN+Liwr+EyLo8MoP/4gwM8+djD9Gm++mufKcohsSicYqaAoXTStRSzikEio2JbF0dEx4XCYay/O87UvR7ly4ZhopIHlTvPocYSf/nSPStXj5Zdf5Stf/TIT42P9B/ZzKqXPYudKpcLh4SEbGxtsbm4OIcAAQpw1oFGtxOgDNgyDUChEPp/n3LlzwyxeJBIZSkcHr4GnbrVatNvtoUGHw2ESiQSZTIZgMDiUjw4Ud8pIWld+QU/k0YDxWV57QONZlkWn06FYLHL37l0WFxdJJBK/UNwxOoOl0xm+9rWvs7m9x9/89Xf5m+8/4PzSa3ztK4uM5e/wwuUqjWYaz4Of/ew+G5uHQH9ZaEP3MTk5xivXJvjNb2Z54xVIp5qoio4iEoCNlP2XgkU+JXntlTjXPwny0cdNjg6PiEZj2JZFo9mi3u2yV6nIarsjvLM9ooc8tHwir/SkR9vqcdyoc1ir0TuZppLJBKqq0242yWV0XroaZnbaR7OmsbWd5qcf1/ne32zgWBZ3b4/z1q9M8/IrS8zMFknE9/BpNpGQQyphEAgYlCsK09MpfuWNNFevNMmla0glzu5Bmnd+VOXmrSMymXG+/vVf5YUXnsPn9+N5J3JE8fOhxkAaur+/z97eHvv7+1Sr1aeMeHRqH1BzA5jxLKPx+XxDtVo8Hh961VFcPQpVBkY2ut/Aqw4YmlGcPvjO2WscnM9QvD8CZQZYfhC4Dgy50WicFPv2hVgDEVQqlXomL/0sL60oCsFgiMXFc/zKl7/M1u4em1uP+NF7BeZnJ5mdTjCZ3+XNl3X85iSphI9bd/ZpNDoEAj4mxpNcvpzh9Vf9nF/soms9ypUEvV4aRUj8wRY+XxVDL2OqFkE/zM3YPHfFZHPDomt7ZLM5Ou0WjWYLT0rWS0UeHh4ylUwQNM2Rrl3K6Xa6g95gruexVS6yXS7KQbCTSiVwHEGzWeXCSpjlFZ1QqEfpKEC1FqFWa1OvdWk26tTrPXb363xyM8+rL2d47dXzzE1V0A2YnNA5f34SXyDOi1czvPmGyUTuCF3TqTTHuHFL8Ld/u47VU/jG11/nzTdeJ5lMPhWJ/zyD7na77O/vs7a2NmQ2Bp75WQZ91us9a5ofeOoBfTf6vqZpqKo6fI0yE6MedzSoOzsLfN45jQ6ywSA4y3SMZhJt26ZWq3F0dMTh4eEwJf/w4UO2t7eJRqMngbX8wvs5ZD1UQTKZ4NVXXmF7Z5f/8O/X+dt3H7C4aJJKhImEPBan9omFJYvzKTZ3sjRaFn6zRyolyGQNfL4wO3tB7j8osbXToFZr4/NpzM5EuHIlw8JckVTsAL9hkYpZnL9gcP2mj0eP+pXt3sj9q7XbfLS+IcdiMfHKwvxJJy9vZNGgAVYUAgdJqdnk4eEBpQFVF4viD/qplBqYusdzl+PMTIEmapi6xVimxFtfimOqz/PpzV1W13dZXd1ga+uAjY0ZNjYmefmlOAsLOjOzKt/6Vpz9A4tzsxYLM2X8viaeN8bObpCPPjxmfe2I5ZUrvPW1fg2gMuItfuGOwSdTf7lcplarnaoMGRjE4DXAn6NU3qjGYxAQDjBzKBQaYtVBkDjq6Uf54YFRn/W2Z8ulzn4+amzPCmBHf2fAU48Onl6vR71eHyaSpJQcHh6yubnJ/Pz8qZ4fv8im6ioz01O8/srLfPizn3Lz+se8+6NVLp6f5erlKP7IDnljg/RYl4sXI9iOhyZcpOdjvyD46QcVfvx+jbv3j9naLtBs9Km9yfEUb7wxw69+PcNLz+nks7sEAg7LSyazs5K7d6s0Gk1CofBJsUSLnu2wU6lwUKshpXey1MmTHLg2CAlVIbBch+1ykZ1yGcd1MXQdv9+P1bOxrC7jYxpXrqjkMz0U2SUcarM4r5DNTHF+Kc6Pf6bz45+GuXfvgIOjI27dfsD21iH3Hsxz7Vqey5fDLJ0L8dJzNtHANtHQMbpuUu9kuHOvx/VPd9B0H9deucaV567g85nPLkP/OdvAaCzLGlZ+nIUYZ4OrZ61SMDDmgWg/EAgMlXODz87ChqdKoZ7hiU+lbEcowbPfHTXws98fTd0PZomB2q/T6dDpdLAs61Ry6ejoiFarRSwW+4Vmu4ES0/MkPp/J4sICX3r9TdYernHjs10+uR5neSlDNNoEex9d2UIxPaSu0eul2dwd4wfv2vzF/1jn+o01ul0LVVUI+E0kgu2dY777vQbt9gqKSPH6aymS8QLTEwpzUyq61k9sZbNpFAVWV9dxPI+W1aPablHvdAifFFNIx+33tuuvNejhSkmz1+WoXqNr9SSAeqLxrVWbCKXHzLxgZq6Oz+fRavnp2ToCBV9ghwsXVKYm0lx77hzv/WSKH/74MXfur1NvNPjZBzd5+HCbq1fn+dZvTfLGK03SiT38PhepTrJ/nOaTz3bZ2K4yv3CeF69eJZ/L/727eXqeNyxXajabwwc/mvIeGMZoxvCsoY1O/5ZlDTOEg7YFo/Te6EAYNe6zcOKsQX8enn2WcZ81/FEIMriuQaXNaMJH07RTGcZfRPtySkh9Un+XzqS5du0lfvzj9/nk4/f56OMyr7+W5fLFLKpaQzhdFDxs6aNYjPHTD1X+4r9vcuP2FpZtk0rFWFqc4NziBKbfz9raETduPeDd91aJRlWmJlOEAg3CkTaz8wrTk34er3cRQsHvDwxPqdJq8/jwSG4eHYv5dApV9NdwEYOG50iQrqTTsyg06rSs3rCgMxKJUqnW8fvazE7FSMd1Oi2D1c0khVKCVtsmm3aZnqiTSlWJRtqksgGWL8xx/bNp3vnRJjfuPOK4UKRYTOB6GXSjim7WUfQUTWuSew8F9+4XMc0Qr7z8MudXzqNret/Q/p4GPUgzdzqd4QMcVJeMGt2zGIXRlgKDIG6QHBnw0Wc53WcZ7VnDHW05cNZ4zzIsp7S/zzDo0fMfGLRpmsNZZBCkDsq3QqEQ2Wx2qDf5eRj6WZvf72fx3DyvvnqNzY017t0v87MPG0yMpUhGa3jdXTxh0u5FWd81+eizOg9WD/CQvPLSCl/+lXleej5IPtdGVSxW19P8j7/WePe9de7eKfLgXpjJfJB8uML0pMfSUpD1rSr1ehshvGFbCNf12CqVuL6xSVzXiZgmHdtGVU60HJoi6Fg2+5Uy66UCluvi9/lOSmOClCsVwiHJ5GQYTQ2wsR3mu3+t8tGnBzSaHWanIrz5aoSXrnqM53Y4t+AxOZlheTnG1GyWufdNjo5dzp+PMjPjEgo20DQVT8Q5PPbxySd7HB5WWVo+x+uvv8rY2NjPXQrji4LCgaho0ANjdOoexbhfJIIf7Dsw4mg0OhTcD2ShAzgymhQ5SwWOGvGAMz4bE5wdEGfhx2jQd9bQB8cfNHRMpVJUq1USicQwgDVNk4mJCRYXF4lEIn/nezp6Lolkgldee5m79+7x6fWfcP1GkVeuxUnGkqAegFTp2SqHBYfdvSaO43JhZZx/+pvzvP1VHzPTR5jGAXgeiXieSj3Fw8dFjgt1VlfrvPySQS4HiYTH7HyAQECl0WiSyUSYmppie3sb13GpdjrsVCo02m1MAbbtIBUFDfpL4za6bdbLBQ5qNSmlxDRMTLPfaEXXPOZm/czMBqk1w/z0I8Gf/7dNPvn0PuARjYQ5OlxGVccJvwHpVBVFNJiadHg7lGFy4iJHRwa5TJ3FmV1C/gaaFqLeiXD3Xo0bNzfxULnywvOsXDhPIOAfLjr0d/UiZ6fygYcaPPyzvO1ZbzdqfIqiEA6HWVhY4Pnnn2dxcXGYDFFVddgs5qxXPWvQA9HS2XMZFUk9i/8+i/sHRbNnA8QBhtY0DcMw6PV6TE1NkUgkOD4+xjAMMpkMY2Njf+eA8Oz1+EyT5eVlnn/xKg9WH7C+XuH+gzYL00GCfhPhdPE8G8dycGwP0zA5v5zjpasqE2MPMfVdoIeix9B8HTSjC7g0Gj0KpRbtTgTH8oiEbGZmFNIpjUqljSRMJpNmb2+3XyHkONS6XVnrdETkhL6TEjS8Pn4ut5oU6vVT63ZalkWn28bns1leijOeD7O57ePd9/bZ3CoRigQxNJ12q8vN2wfMLiSYmZ+ga6fotBx6doBmRxCJ+MlnXPLJMqnoEbrSQ8osR0d+PrleZHu3QX58kUuXrpDNZk68UV/C+ve5+aZpEo/HicViJ61ve5gnF/2sUv+znnXwdzQa5dKlS3z1q1/l4sWLwyJXXdeHBnTWI59V743Cm4HY6azxjhrnqDce/Wy0cHcAnwb886AxzeBcwuEwY2NjpNNpVldX8fl8RKPRIdz4h2yKopLOZrl4+RJTH8zx+O7HXP+kwvOXciyfSyDcfTTVJhxSicV0fD4NTfX6HUqFjSIMbNuga6UpVJKsbzkUiw0c28L1BFIq/VR4sMf8lMfMjM6Dx1WKxTLJRHx4f7qWzX61xm6tTtIfJGgYeICG0jfhWrfNcaPWXyPFNMnlc0RjMQ72d4kkJFMTMfBCfHajw6PHdaanElx98UU0YfDue7dpthya7Tgf3UhSOtpja7OI7ehoOly5nOFX3rCJJw7xmW1UodHtBdnZEzx4UEZKkwsrF7iwvELAZ/5dSY2nDFrX9WHbgAHn+nm1hmen9wEeHSjh3njjDa5evUomkxm22dJ1fRgUPgsLj+LuAfRpt9vDPhuDbqOxWIxUqt9T+iweHg1WR5M/nU5n2MBmIG0d0Iqapg2DwXq9PpSwrqyssLy8jN/v/3vj51MOQzeYm51maWmJu599yr37Fba2xzh3LoVQDjH1LvmsysxUlFt3C6xv1VndTDA9twR6l2bDYG3Tz3s/rfPee5scHRdJJqPEEgEMs3+9uiZIJiTTU37CQQOESTyZIJ3JcLB/0Jf2Wj02KxXmEgliAT+256H5TJNGt0Ox3aLa7kgpJX6fj/BJWlfTHMbHfaRSIfb2HG7cqAAKX/lylm98Y4xGDQrFLJ9+dsiNGw+5fXuD/b1DDg6OUPUAS4vjrCxH8ftaCLWCUFyE5qdeNlndsNncrOP3x1hZXmJ6cvIUXfX33TRNG1akD4Tvz4IEZznkwXTu8/mYnp7mpZde4uLFiySTyaF8c0DZfV6AN+ijYdv2kCp79OgRq6urlEqlYZBqmiaTk5NcvnyZc+fOkUqlhrz2qIcfBLK2bVOpVNjc3GRnZ2eYMHEch0AgQDqdJpFI4HkerVZrWEibSCS4cuUKi4uLX7ASwd/RqIFMKsXS/ALhcIyNrSL3H1R45eUg0YCJz+iRz/VYuRDm+u04j1eP+f/8qeTgaI5IyKBctnn4uMJnN3dZX99BSsHCfI7lpQixSBlFsUCRhMIO01MGsZhGsdzvEx2ORCgVS9i2TcdxKLVa0pZSGLqOZ9loIb+PcqdFodmkdcLX6ppKr9dXjKm6w+R0An8gxOpqh7W1EqFQgJWVFOMTsGW30VSHWq3B/sEeitAQCpg+lUTcz5UrUa5clmTTTTTVOlFhRyiWTR48aFAodlhaWWZufo5wJPQP9iAD/jidTrO4uMj4+DjFYnHIbnwe9zvAqLquE41GWVhYYGVlhUwmM/SYA6gxOhAG0GC0jGs0UHQch1wuNxQrNZtNjo6OqFQqPHjwgL29PQqFAsvLy+Tz+VMKvkEqu16vc3h4yKNHj/jss89YW1sbDg5VVQmFQkxNTQ0HxsBDu65LMplkfHycSCTyD7qnZ7dQIMTczAwLC4t89OGPuX13l929OcILYQzDJh6tcnHFxxuvjnF0WOedd9b59JMSflOj1WlRrtVBeoTDIS5fnObtL+d54VKHZKyIonYQikLI32NqXCUelWxs1Djc1+hZzlC+0bMdqp0u7RPYJRSBhpBYrkO13aJlW0Ntr2XZ9HptfD5BIh6l2wvzaPWYo6MG6YxKoaSzuhZgc8NiZ6+JaSosryyTiAXw+3VUVSeTMXnxRYX52RIB3xGm6oH0YdsZ9nYNVh9to6g658+vMDs7+7me9O86JQohSCQSXLhwgZdeeond3V12d3eHPeWelYgZLXNKpVLMz88zPj5OOBx+inMe1VQMPOgAG5umiWEYwwDNNE0SiQTnz5+nVCqxtrbGnTt3uH37Nvv7+9y7d2/YYObKlSucO3dumPjodruUy2U2Nja4ffs2N2/eHDbHUVV1WKc4wPaD2sXQidR30B11UMv4y/HO/WvXNY2J8XFefPEqDx7cZWOryup6j7npKAFfE59eZ248zFfeiFCvzfFX37fZ2j6g6LioioqmKWRSKV55aYGvf3WCV661mJzYQ1W7tFt+VMtACpVUUpJJqwg6VCpVNE0fJts8KTlutTio1Wlnsv2e0eVWg6NaleqJMkzVNGLxOLph0GpViYSC+H1p9vYEN28XOS6UqFTr/Ol/EaRS0f5ac1qY3/qtJd58PUMqVsRvVtF1D1+oRTzaJhoqY6gtFDQ8/HS6EbZ3HPYO6iRSKc5fOEculx2mMP8h7MaokWYyGZaWlojFYmxtbT3FdIwGcQPqyzRNcrncsD3XgKEYFRCNevSBYm7w3UFj9FKpRLlcpl6vD41rEKCmUilWVlZQVZWDgwN2d3cxDIN4PE4m019eWFVVms0mOzs73Lhxg08//ZSNjQ06nQ6BQGDY6X9xcZFMJnOqxW6z2cQwDJLJJBMTE/3F5U8KEP7B91aA9CSKqpBIJphfmCeTyVEpb7K9Ba12lECgjK7XSMQPuHS+i+nLMzPzAjdv1ymWLQxTJZfyszCtcmnFZmlun2TKAZGkVFpg/9gPdEmlSxj+BlNTJvFYD9s1mJiYRADNVt9e25ZFrdul67qEDQPNdhwOqlWOarVhtByLxehZDj2rSzweIZUIoKgGwUiIcDhOoVDg0+t3EeiEIn5mZibRVI1gwGB2Kkgu3cDwlfG8Bgo9FOGc0Mo6ngxQqSts7zepNbssLKYYG8sSDPp/IX3y34WP9vl8TE1NMT09zf3792k0GsOgbpTfHeWG/X7/EI8OMOcgzX2WDhwYqpSSSqXC3t4eW1tbbG5usre3N5z2B9oSy7KGeHdgvD6fD1VVGR8fP8VxD3qJ1Go1dnd3OTg4GHZiCgaDw/557XabUqk0pBIHxQa2bZNIJFhZWTlV+f3L2wR+v59cNksun6NQ2GVnv02jlSWdCqIoEkVpEI+2eO6Cw/REljde8VOp+xGKJBnXySZ1An6Tbtvk0Tqsb2k8XnfZ2KmQzyp85cthxvIuM5M22bTFYckgEolQPImLhBDoikKh1aLYbhMNBtFUpd+qoNHtykFNmfQ8ut0ett0llXKZm6mQTjtYVpTx3Aq3b2fZ2ipQLJdo1Ovcf/CYVqvO3u4EL1yJcPkizM8EyKa6RIIthOohUUGo2I7JcdFh/7CJlArjY2Nk0qn+7yL/TsuWf5F3Bvr9jVdW+Na3voXP5+Ojjz4aNpgZeOqBIQySHoM+dOFw+JTBn/XuA8ZhoGy7desWH374Iaurq/R6PRRFodfrDfvUDbB1LBZjb2+PRCLB/Pw8Y2NjTE5OMjs7y/j4OMlkcujpRytkXNcdDqpBi91qtcq9e/eGHZ8SiQSxWGzIoAw6MA06lP6yt0Gv6vz4GLduKWxuFTkupZme8AMmeD00IVG0AkaiSiYZwPbitLt+6q0uByWd/YMgG5s+Hj1scff+HqtruxSKNS5dGCeTPsdYOsR4tkss5rKx2x1KGZSTym8X2KvVZKHZFAvpNFq93cF2nP7aFgwWxmnTbvcwDUE23WNyfIe5aUiGgrz6Yo7Ha+N89FGb9z9a58GDLarVGhsbe2zvHPPTjyK89PwM3/qNHG9/RYVQFSkdhDBAqPQsk4NDh+Mji2AwzvLyCuNjkwihfm693N9Xz2HbNoZh8NZbb7G0tMQPf/hDfvCDH7C7uzvsvzzKFQ/464FBD7Dws5oeDooItre3+elPf8oHH3zA7u4uiqJw8eJF5ubmOD4+5oMPPuD4+Jh8Ps/58+eZnJzkwYMHlEolHMchGo0yPT091CoPgslBsDfosqTr+pDKGzSJ1DSNbrdLsVjEcZxhawS/38/58+d57rnniEQiaJp2qrDhl2nQsXicqckp/P4I29vHrK83WVk0iPoDuD0bRWiASc/SqXZDVBtJ9o9iPHzscfNWkdt3H7GzU6JWrdPt9k6WbNPodFSOjhVsWyOW8AiGO7TbgmazPZTxttpt6p0OZcOgdxLDaPuVKqvHBTq2g3bS9jUYCtFqO/h8KvGERjBgIcwuqWSTRKpONhNldibCtZcnePRolo8/KfLJZ+ts7xydNMHu4rgWQlhPSs0VgRQm7Z6Pze0WpXKHZDrH3PwcsXjslwo1PM/j6OiI69ev8+mnnxIOh3n55Zf57d/+bV555RU2Nja4efMmH3/8MZubm8P+GaZpDhsjDvQQA2HP2XMbYOZYLMbY2BgvvPACL774IplMhtnZWTKZDMfHxyQSCR48eEA2m+XFF18cBmiFQoFLly7x4osvMjs7O6x+GcXzg1UDBh1GBwM+mUzSaDR4+PAhjUbjpKdGmmAwSKFQoFqtcnR0RKlUGlbN/DIZjlH+PhAIMDc/T35iktVHR2zv9Kg3/UTDfmSvioeDJf2Umzk+u5vkhz+qc/3GTQ4OqlTKLSqVJmABKvFYhMnJNIsLOS5fSnLtqkIwVKTrQiIVxTQ6OCfNjnx+H62Ta5NSIk9mTq3Z61LtdHA9D+0knQv9NeBiUR/ZXATD10PaHTzXRlE7xMJVwsEQc1MZnruQ4cqFNFcu+7l9b4pa3eP5SwkWZh38vjKKAtJTAQUXk1bHz9FxlXbHITfeJ8pN0/dLMeTBQ2u329y5c4c//dM/5d1330XTNFZXV/n2t7/N1atXWVpaYmpqinQ6zaeffsrW1hadTodQKDQ0jFFM+qyKcE3TiEQizM/Pk0wm6Xa7Q3HQgHbLZrPE43GuXr063L/ZbDIzM8Py8jIrKyvMz88TDoef6sMxSK1HIhHGx8dpNvv69FAoxPLyMo1GAyEEq6urxGIxzp07NwxUj46OqNfrPHz4kA8//BC/308mk/mlwY7RWcrQdfK5PLlsjju3XNbWyhSOM0xkjX5Jn/BA8bAcnZ0dwfvvF/jsxirQ5+NTqTTjE3lmZ+LMz/mYn1NZmFWYGuuSStZQ1ApdzySXC5JMeLiugzK005O+ha5Ly7JodLtohq5haurQ6ziOQ6PZxHEt4nEfuUwQn99GeC6KMEBqqEgUOijaFpnkAYlrSRYXU6xtZykUVfIpmJ89xGc2TwoYVYQU2LZOrWFSKNi4jko6lSUeS6Aq6knVgfilQI2B93r06NEwgLp58+ZQUvr8888zMTHBa6+9RjQa5caNG+zs7GCa5pALHlB0o4KiUd3EgJcOBALD4tPRdPSga/8gBT1YBKjX6zE5OUk+n2diYuKpdPQoLBhk+sbHx4drukSjUSYnJ4dS0FwuN2ycXq/XicfjOI6DaZrs7+/z3nvvDZs+/rISK6MeX9NUEtEY6UQSPJW9vSrlYgI8H0Lpr5qlSpeAv0k8qpKMeUQjBrrh49ziBJev5Fi5EGNhXmN6vEs6USZgFlFlE1WxkYpGOKSTSqrEoypHxS6BYJzQSOvgVq/HQa3GQa2KZnse9knSYeCZut0OjtMlHNKJhT0Mtb/0mVBOOuJLQKioCui6jScPMcwysYSfnmWiKQ4Bo4mmuuBpIPvHt3oa5YrK/mEXD4PxiUkS8QQCget5fy/txtkbPFiMp9frkcvl+NKXvkQqlRqucPXuu+9imiYLCwv4fD5mZmao1WrDDF4ymRxWpYwmYwZQZjSxMqraG9ViDPDuoPnMoLVuLBYbUoGDntFnu++PctyDNmK5XO5UkcFg8MzMzBCJRGg0GrTbbXRdJ5fLEY1Gh8Hk7u4ujx8/ZmlpiXw+/0tJXJ2GXhqRSD+QDgbDdLodOl0DKXUQBgIbsImEuszNJlleyrC6WSEcCfGNty/z9lseE5Pb+H3HBA0PTen1+/J7st/HTij4DYVoSMHnU+j1uoSC4VOV/z3Hodhsclyro60dF4YMRx8zqrTbXTynRySgEQvZaIqHawmQo6qyJ4uIK7j4jDY+w+pTc64EaaOIwX4eQgFPKnS6Hu22g6EHSCUTBAL+v3NFyi+SKcxms1y9epULFy4QjUaH1Jnruuzs7Azbew2CskFr2nQ6TTgcHjIZA682EPWPCpnOthIbTQj5fL6hhx1ttjjw8P+/9v7zvbLzuvJFf+9KO2fkDFQusljMFCmJoixZwVLbsi237WP3cZ/ufs6597+Q/ot7zv3QwW3LsizZyqElUhKDSIqhWKwIFAqFnLFzWuF9z4cVsACCEimL+uT9PHgIArs2dphrvnOOOeYYYcMZH/UfbzrDxjCcVoawom3bR2TQlFK0222klOTzeSqVSmS7cXBwwMHBAe12mw/qphsGqVQSK2Hh2H7z5noGhjD8OMAjmWgwNJBidjZLqZCk2XHo9aoU8xqjlSrCqwYVgB9RyhfORUcnYUI2q5HJ6GhC4DoenuceLzmVVEIYq/vVaOTt/0KCgmTSpFgySWc8EBLlBawyFVMTU6HFvQ5Shpu2aAp8S3HP12TSJEoI+rZHo96g0+0gtAyWZf6rsvK7ZepUKsX58+cZGxuLjuDR0VFOnTpFu93m+vXrLC8vMzc3RzqdZnh4mNOnT1Or1aJyI5wCxklIJ61PncSUC7+PE6OO69CFfJDj61XH2XdhUIfZPiRG6boeSYqFNX0ul4vIT3Ghm7Dh/KBu/olTIJ3O06gdsLFtU2+nGSgY4HmAQtO7ZHJVxifSVMpJ1tYPWJjfZHd3kJlxgSlABp7dhFq4SkehMHWHQk5RKPguaqZpgUi9c0IMGD3HwZOHb6BpGvQ0F8MUZLI6ZkK+Q3bp0AwgFMYLglwFJi4RnqwF99GQWLQ6gu3tFq1ml3zRisbKsb3z39obHEJvQgjq9Xo0wPBdrmqRplwmkyGRSDA+Ph75avd6vUicPO52dbwhOr6ZctJe4klLtyeJypy0ahV/PZZlRXYU4XDIdd1I8LFYLEbDG9d1o6FOvC/4IG7haTQwMEi5NMzG+hIbWz0ajTSDZR08Gem+JFMOo6OSmekCN242WbpX4/ZChdmZFMMVE0N4IHzBGCV8JSSFjhA90imdTNrBdvrYrkcyUFyNnBM8SaPfw1DisP70PI90Ok212qLXbWOZWXTdO7xihHpH4IWeLOHvBV4Q1KDQgtpbQ4kMPSfDwX4Pu69TKVcYHR3BCrrV3yasFGK1ceQhk8nQ7/fZ3t7Gsizm5uYiTbl2ux0p63ueF+HTyWQycsAKM2PYJB7fJjlOxj8e+PHRebz+Pv7a47uO8SllXBUpjo/H9yFD5VIpJYlEItpMD9WefpuT2COojKGRK+QolAp+k9a0sftemOP89KY0koZkYKDL+YslrrxdYG9/i1t3ejz0cIqBchpdtBBKQykNpYQfVsIDJTB0MA0b2+6yubnJ4ECWfD7vl19S0nc9dtptjHh82oH4oOM45LIa+YKBYR3VdxQqdD58N2Khb+ISBnigEwpYKJlBOqCRIJ3OkMlm0X5LpJnjt9D3JEQiwhWqBx98kJmZGZ5++mmGh4fRdZ1utxuR9UNF/3BkHV8AiAvExMuLd4PDTsrkx4P5JGmD4+VM3MMwDPBkMnnkvmFJEV7Moftt6Harf0Dvc/ipW5aJlbBQUmL3+jiuc8jLQUNJha51yWeazE4NcmpuBJROKllB4CLlPlI0o76MuMizUFhJg1w2ScJqR9sp0WcA9D2XvuseijWGWyK27aFpkM8bFEsaphlm6N/kqpYgZJDFFdIVuMFwwLJMLMP8wN7kEG2wLCv6Gh8fZ2JiglOnTjE9PR2VFOEaVagHHU4B46byIXMtlP46TlZ6tx28k7L3cRHzuD5IXHkpHqxhidFqtaKMG1dOim8ZhZZv4aZO2KB+kDdNA133g8t1XTzXC2JG97eglEATHrlkhzOzbf7oDwrU6gZn5voMl2ro9BHEbCYE0UkvhE4qnSRfkqSTTbS4gE/wvvZcG9v1MERMllYTwjd01zUSCY9EUiE0GVjK8hvUuoelCErhug59u4vCxTB0DEP/LWIbR4M5/BDDoYVlWYyOjpLL5Ugmk2xtbWFZFgMDA1FQ9ft9ms1mlOVCyC0M6FBuK74cGz/K4zjycew6/rPwBDi+RHuc/XeoXqRHE8xwkz3ElY8jI67rRhYVzWYzIjOFCM1vs9w4/klrQeZ0pUDK8CeHcuRC6aQSLtPju0wMO2gG6OxjGA1MzXdbO0mHRRMC0xAkkgLNiKFssXs5nsTxXAwlYzla+FnVnzj5qu6HJ6P0ryDx3uNYEara+KMYz1O4totSElPXMGJH928zmBOJBKlUKkIFQonZkGJ5cHDA+vp6NEgK1e1D/kdYdoWBHN8JDPkhyWQyqlmPa9O9G6c7/Bvh44ZlgH7C+xDfoAkNQAcHB6MLIeRyHL9IwtIkdAkYHBykUCjwQd80BEIJpKfo2x62ow57q+CEFwgMzSOTPPANo/CBBi0AFVTYkwXRE71zSoLn4LleTPYreqMOszoKo9pu0w+OLBn7Jf8KdFgd+y6E+1zPwbEdlKfQNT0wrPntNiphdg4zbLfbxQwUoELKZdhghfK3YZaLN1/hcCYuV5tMJkkmk1FQhYOW0LItzK4n7RvGJ4mhNNlJUgbxhjJea4f85nBoE15oIecjNCkKbec6nQ7lcpmpqakIV/8gb+Go3vM86rUGjWbeh3IJEnW8KhYSIcKTSAtwZ3FyBaACOX7hgfAQ6phWS9z6W0SwnYz9VvxWhxzx0PY8ie04SOmrRUav9AMoOUIMuFqtRu4DYRZNJpNks9lIxDHMluG2SbwZCzdH4utW8bF4OOkL6/C4oc/xfcWQ4B/awoUXWngRxZWXQqw5NB+q1WrUA856uABwPKN3u122t7dZXV2l1WoxPT3NwMDAEXL/B3VLZTJUKgMkUylarSqNWhNPauia7pM8Y/Wun0t9SPcI5PCuqm+BFkEIRoiTylpf2NHw33jtA716I8newMBciePOGL/tv3doIh8OIEIIK2wEQzgr3NkLOcUh/qzrekS9PC672wvse+OG8uGk9fjo+nhJEF4U/X6f9fV16vU6tVqNdrsdlRHZbDZq/EJp4JWVFXZ3d8lms9HSa7izGG7OhEsGGxsb0RQ03PT+wEuOCJrUA79IGSEUJ1ekR01/3vWzFD4mHQVSFPnvhI91Xx9anVgsHCZr9b6HHseFyQUKTSl0TWAaJkLTkEqi8D6wNzgk01uWFZHCTxp4hDoe4VEORAOWOOstRDjCIAr/RlgTx0uWOL8jPiYPx+eGYVCr1XjzzTf56U9/yvz8fIR9W5bF4OBgZEgf2oBsb2/TbDYZGxsjmUwyNjZGPp+PbOZarRbr6+tRdh4fH2dycvLI1vsHkz38j7ndarK9s0m71SAzlaBQyKDTAS/UEtGPaL68I7hPyMyKUEpUxapk9S4B7Z/3hic9jtpuBncO06r67b1ozdAxDRNNaEhP+ZyPE+ifvw2wPxw0hFO1kMfRbDYjfbqwXAjdXePSWWHpEA/msKwIn2sYzPH6OY5ShIEdH46Ez0dKGTWuoX9hCBEuLS0dWRULpc1CglP4+sLhkW3b7OzscPfuXVZXV0kmk5w6dYqZmZl3oDAfCLwBeNLDcx0MQyOfz5HLZkHrgRfMJcT7D5kjMS40EDqa0NF0E8MwEZqI3dMXHTV0oUWd5fH1J/X+k/O7lhwIgaEbGJYFAlzPiUa5H2RtF5LQw6BuNBo0Go1IBCYUZAmFWtLpdATNhQEYr1fjwubvhk4cD+rjw5NwIfahhx4im83y5JNPRgb2i4uL3L59m+3t7ajxC8UhQ+ZdiFqEmyvdbpf9/X22t7ep1+uMj48zNzd3RDb3g3yPI1RCC0q2hIlpGj447b0jr72Pa0XFmkXhr/ERQ5TCmiV2DyNlmrT79rGr4XiV/lt4sRwGtKaB67l43gcf0OGHGUciwvH27du3efnll2k0Gpw+fZqLFy8e4SfHYbW4f3dcYDweqL+qpo/DeGHWHh8fZ3x8nA996EO0Wi22tra4du1atJtYq9Wo1WrYto1lWUxNTXH69GmKxWJUwoT2caHvd8jBDhl6v+3T71clLanCwFag+0O1f2XiPwIMhsXHkZ7s2FzRSBp6tE94cgUTtpD/mnrDH9AIU8M0DQQaniNxPflbJSW9F/Qj1LGoVCocHBxQrVZ56aWXmJ+fx3VdHnnkETKZTMRkC8uTsOQIg/w44SgM8JOkdI9jyvHJXohuhFzmZDLJyMgIW1tb7OzsMD8/z71793Bdl6mpKcbHx0mn01G50+l0ODg4YG9vD9u2GRgYYGpqimKxyO/y5kmF5/rolWnqGKb2LtDFbzCYC0ghQoXVhP8VN4s9NN48HJ4Hb7wK4EMDsBDC5ZBJ95tg0wEDTygM3cMwfEX4XrdPr9sL0AD9dxLY8UDLZrNMTEwwMzPDm2++ydbWFgsLC0xOTjI3N0cqlYoyaZwhF5YicWvm41yMOJ4cr6VPGoLEM3coYZbP5zl9+jTtdpsHH3yQhYUFFhYWIny80+lEWHaImITsuvA15XK5I0jLB31zHS9IAr5CqWUkQOr+l/IC4tp778niswwVzMI14SMoR/Jv8P4ldQPLMDBEDHcOj2aARr1P9cDBsYHsb1IBHQaRQoHqkzK6lIs6pqlxUKuxu7sb1Ksm6neUqONko2KxyNzcHCMjIywsLLC5ucny8jJDQ0NUKpUIn47zl98tgE9S8j8+yo7DeHHnrNCKLa7EFOqKjI6ORhDcxsYGtm2zubkZ4entdpter0ev1wts2A41ReJmSB9odvY8Go0mtVodTSiyGR2fKxUQ00RsbBLrKY6XQ0dJW+Jwco7E7tk0G5JuzyGRcJHSQ6rDKXcmYZFNWBgy9iCGaaJrGppm0OsJalUPxzHfFU9871Hkoqkm6WSO4eFBMlmTZrPNwcE+ruv9To/GeLYKl0dDXkSv12N7e5vd3d0jSvhxCO+4u+xJ9hLxrZbw967r0mw2abfbOI4T1fNxk87w34RTyvCDD59DoVCImr9er0c6nY54G6EKabFYjPqA30VmVkph92329w+oVvdJJgWDgyaZrIuSth+PQnv/1caxAr3XdajX+3Q6DsmkFm3jh7esZTKUzWD4ILgSgDIMPfDkMEkkc7heEpQF9GJYoHxfhYdCoZSHJnpYSYd80SCdsajVPDqdboTpflBDll91SyaTDA8PMz4+zsrKSgSjHRwcRM6xIcR2nJtxksNVPOPEOdBSykiccWFhIRKiqdfrbGxs0Gq1onWt0Jm22+1G4/a4KmkIG25vb0cXXCjVm8/nKZfLvxUd6PcSyOFz8odTddrtJtmsxchohmxOQ3pO0BeKQ3PXd3ms4wknursSSAxsT8d2hM+8S/mIlOe6hyWHYYjhbBZjplSm3unSCEQ+3AB56PUktapDv5sEoRPxjET8r4n3WAeBUhqarpNICJJJnX6/x97ePr1eFyj+TpvD8MMwTZOhoSHm5ubY3d2NxsqtVovd3d2IkBQ2ficx4Y5LbB2HycJx99raGs8//zwvvPACe3t7UaCHy7mWZR3BtkPoMGxG41vfIS8ln89TLBaj4crAwACjo6MfeEAfZREKHNej3enS7/fIFDXyuRRJA3A0UFowUFG/8vHecaIoP7ErBNIzaDV1mk0Ny0piGDqNRoN6reabboY9iNAxytksiRj4nkgkcNwOvX6fVitBvydACISufExR/PpuNd48BjiAL3+gC3JZKBdN7i012N7eolZrHNFe+10ck3FYrlgscurUKRqNRpQ5u90u6+vr0RsdBtXxmjnuDXj8uYf2E57nRc5Zg4ODXLx4kVarFW1wh1xtIJJZqNfrUW0c1taO49DpdGg0GiQSiciQNOSBpFIphoeHqVQqR3T4PvjkIOn0OtTrDfr9Lpm0IJPy0IUXBJuKxtyHwSHe09nul7oanrLodhN0Wi5K2ZiWSa8rcMPpL+B6HrbnYRi6jh4TB1RAKpVEKZtOR9Lq6CipoWkK5cUpge8XVVRYpkO55DI2kuBt02N7e4uDg/0AAdB+Z4Ecz6Kh7kUYSACrq6vs7e1hGAapVCriQ8Ttk+PMupPq8zDzhAy7SqXCxz72MT760Y9GmTeVSkXTTCEE/X4/UvwPB0CNRiPSe15fX2dpaYlOpxNZY4S8kkqlQqVSIRPoVXzwySE8gVxqtRq7e7t40mZktESp5ICoAu3gbto7gjh+vr/78/QHK46n0WxDpy38CaFQKHlY8hiaRtZKkLUsjKRuYAQBHW46DFQqoCT1Ro+9qqJvC5KG7zT7ft6iIzxr4WFqffLZPpMTCTIpwc7uDts7W/T7PVKpzAdOcTwp8MKF2hDVsCyLg4MDdnd32d3djY77QqEQbYSHtWzokBXHoE/yCQ8Vj0IeddzeOERSTNMkm80yMjJyZJslpLmGwTw9PR35L4YTz16vRyqVolKpRNyND5TMLw4Xpm3HYWt7O6jpBadODTI4pCNEA6U6KM1EYB4GdcANUv4y668pNf2k0bUle7Uu9VafXC5Lr+srrobxkkskmMjnGc/nMAxNw4rpOxiGTiqVpNvt0Wg67FX79BxJ0tL8flCL0wDf45RQ+f9W02zSyQ7TUwWGBjPcW6+yvLJCo9kglcoERkG/2+ZQ0zQKhQLDw8PRqDmfz+N5Huvr6/T7fbrdbvT7MJOGw5Y4L/kk2+O4pEHIEQkHImEmDrdi4gETZnDP89jd3WVpaYmdnZ3od3HKqeM4kX7HBylXEC8zhDg0+ly9t8r25ibZrMX0VJFivg/S8XsvFQatBKEFEK6PJQvhc/dVbHYXrlX5vDiBVDrdnkW97tJq+3fsdtt0Ooc6IwldJ22ZJA0DI5tKkPevaqGUUo7tj6T7toNjd9jeatHvKciL3xCLVtHhAX0ss8PIcIXhoSS3Fve4t7zG7t4BQ0Oj794gfEBNTZjFcrkco6OjUZM2ODhINpvl3r17USYMKZ62bVMqlUin09FIOu6IdVJQhxk5pHqGZPxWq0W1WmVjY4OlpSXW1taiAUmIbgARzmwYRnSahOSkTqcTiTUODg5+oMuwJ+HP9Wqdu4uL7O9vMzNtMjqik071QTkIYQSTvQAvVuoILTo2hw6VMojGf8KXx1BS0uko9vcdarU+hWIW0zSOnISuVEIJgW4YGIVkmlxwTHlS0mq1A9IQNJp9dnd79LoWhETt37CE9qshF8voM1CGgQELz+2xtLzM5vYOF85f4HfVD54kGJPNZhkdHaVWq+E4DuPj49y5c4ednR3a7Tbtdjti7DmOE6ENofZHfNk1LiITnxLG3WnDwUg6nY42TnZ3d1lbWzvUQA4WeLPZbGRTF5YgIRTYbreZmpqKxt2/GzKSiHquvf0DlpdXcZwuU5ODDA72MY0G0u4f5QYpjg7PjufHOKynIkkupCto1iV7uz3anT7lioGmHXo7GppGLmmRMAyUBCNpmCRNi6Sh03M9bNvv9FPJJM2GTq0h6HQCs0bRewchBd5ZgYhjtCR/QdLnRBuaS6moGBlJYBiK5ZUlllfu0ek8SjaT/QCU5t/9Zts2BwcH1Gq1qAYNmW0XLlxgb28vatLii61hFg+3QcK6NSxJjm+rhLXycdgwLsZomiblcpnl5WU2NzepVqv0er0Instms9H0r9lsRp7eiUSC2dlZZmdnfyu2be/n1uv12NraYnNri1TS4PSpQQaLLqg2yvViMgMiKiNCXaLDLI2/8CEAqYKYUkGi1nG8JHt7OvU6GIaJaVq0WjVagbRZ2jKZKuQpWBbtXh8jYegMZTMMZDKs1RsBJVEGUFWagwOdg1oGPBOh9XyJ1LAueg+MPIEWXHwC5WkoIUknO0xOWoyN5rl7b5/5G7fZ+cgO2bnsB/KBHKdzdjodVlZWeP3117l27RrlcplPfOITjI+PR1kzn89HywEvvfRSNADp9/tUq1VKpRLj4+MRBTbcrI5DZnHSf9g8RpklhnTk83kGBweZnJzk/PnzrK+vs7a2xt7eXsQnCTNit9ul2+3SbDZRSjExMcGlS5eYmZk5snH+wWL4/imzt3fAwvwiOzs7lMpJZudKFHI1UC4o3YdrhTyk2McAXSX9skKF1DktnJLrKCUQmodEo2WbbOxCvSHIpFOkUkkODuyIy+JJRULXMRR0+32MpGFQSqX8sqPewHVd9vf3SaVyWFaa3T2PzW2B3bcwQtGQCFD5Nan6pHpauRh6k6nxCmdPV5ifr3H92i2Wl1c4derUB1LnhRnTcRzm5+d5+eWXeemll7h+/Tq2bfPZz342yrLhClQow2tZFmNjY7zxxhssLS1x9+7dQPpq4AikVi6XIyQkzNphUIeBftytNq6hp5RiYGAgIhft7Oywu7tLtVql0WgcGZGHKEixWOTSpUuRIOXv8ua6HltbW9y4cY12e58HL5eZnXawzDp4fT+YI57Q0U2oo1tU4jCGhA4qCVKA3gcE7Y5gebnHzq6N4/lC9rVa7VAtytDJmBaWoaOEwjB1jZRpkjYtNCGElFLV63UsK0U6naVeP2BjvU+jlaSSMxGeRAbsKfV+AI+AZCKwEaLJ6HCJ+y8WeOFFk9XVVRYWFnjyqSdJxRSBflvDE4C9vT1ee+01fvzjH/Pzn/+cW7du4TgOZ8+ejVb94+b2odfhM888w4ULF7h69SovvfQSr776arQOdffuXarVKqurq4yMjDA2NsbY2Fi0DR4us8YbxuPadvHpYDjqDj1SRkZG2NvbY2trKzIGCkuNTCbD2bNneeKJJxgfH/+dlmo+0tBleXmZW/M3MI0e588mGRuuI8Quyuv6JznqkAIUInbxwZwKbOKiH2kg9SB7+0u0zbpk5V6bg32bRNKkVjugEzhgKR+yE4O5HNl0Gk3TMTQgbZqUU2kSukHXdRBCizxG6rUqG+su+/salaIFsuPDNu+jOzySyYUDtCmVbC6cz3P2VIEbt1vMz8+zvrrK6TOnfytTw/ia1OrqKj/84Q/5+te/zltvvRVJG4TadaH9WqifHNeLS6VSzMzMMD4+zkMPPcSTTz7Jq6++yttvv83KygobGxtsb2+zvr4ecZgPDg4i7nKxWHyHwlJ8yhiWIeGuYnxfMZlMksvlovlAnBAVyppdvHiRTCbzO6ubwyS2t7/DzfmbbG+vMzGW5ezpMoVcF40OnnRAWAFEd2SCEo3LD4crKto1VPjxoYQAHRzH4GAf9vZsUAaDA4O0Wm067Tb0++hCkLcSlDNZUlbSd6EQmk7aNCmkkqRMk67rYDs2lmlQKhWpHpisrbtsbQtOzSUwRAuBRGBwuNn7Ht8MTSCQKNkladUZH8ty/myZO0trLN69y+LdJSanprEsM8A69d+4zAiP8zt37vCNb3yDb33rWywsLEQ6diF7rtVqcefOHdbW1jh79mwUYHEDo5D3MTExEZloXr16lRdffJE333yTlZWVaIM7hOBmZmY4d+4ck5OT0QkQJ+bHhdHD0XYI64Uj7263G5UaoYZIaJ1x/vx5HnjggYjI/0EHdORQJsDzHFbWVpifv4XA48KZYeam81hG04eb0YL1KRlk2lCRVp0wNYzpJuIhRdg1JujYGTZ3DJotjWwuQ7lSxnHc6CQqpdMM5nMkTTPw8dHR//zBy3gy8Kjo99hut7/sud6XQjJOp9NGCI/ZGZOLF3QM0UFJX0VJCHVkg+DXDlhChRzPQzc0lJah1cxz42ad9Y06A4MVzp07Fwmj/Cbj8PgHu7y8zNe+9jW+/vWvc/v27SO8jDATh/zjkKQUSofFBc7D+4TSseVymeHh4chDJVT8b7fbHBwcsLOzw/b2NltbW2xtbUUw23H0I/xvqKHX6/VoNptUq1Wq1Sr7+/tsbm6ysbHBxsYGW1tb1Ot1pqen+cQnPsEjjzwS6Yj8NsxKf137EwoG7e7t8pPnfsqzzz1HJuXyqU9O8qHHNTKJdQSdYxIcWqCZFPA1heYDBOqocH7IfpPKjxPNMtmrpXjxJcFrr7VRKkkmk2J1dZVG8H7mEglxfmiI2XKZbCqJpgmMhAbSMpgsFpgpl7m5s0M3GGfajksqZXJQ63NvuUu9nmewqAVGQCeBie9jHi475NNNLlwocXouz9Jza7zy8qs89vDjlMvlWJZ+f0Edlhlra2t8//vf51/+5V9YXFyMMvLx+4WOWa+88gqzs7N84hOfiLY94lTRMPjC6Vw+n+fy5cuMjIxw4cIFbty4wfXr11lcXGR7e5uDg4OgabrB2NgYZ8+e5dy5c0xMTFAoFKK6OmTZhTp64eJuo9GIgnp/fz8Smgl5ISEGHTLrPvj6WQSjbpubt2/zy1deo1Hd5fHHy1y6rFGu7KHcKkpzAh2N40ku1vypw3Eb74B4QegKqXSqVcHqSpd6vU8imabX6bK/71vYaUIjk0gwni+QTyX9fQAhMCxdwxAmg+kUpVSCtGnSjXSITXK5Ap3OHotLDksrGuWC7q9R9eP2Xu8lqEO4T/oWb9LG0upMjrd59JESb9/Y4/at2/z85y9w+swpZmang6B6f5nZtm3W1tb40Y9+xDe+8Q3u3bsX1bCO4xxRJQolArrdLlevXqVYLDI8PMzDDz+MZVnv8PaLB3ZI+RweHiaXyzE8PMzMzAx37tzhzp073L17l7W1NarVKgsLC2xsbHD79u13mBLFT4ywIQ1NNff392m1WpEITViShIu9nU6Hz372s4yMjPxO6LZKKfb393n1lV9y/dpVyiV48kNFzp+1sawDXNfzITcRK1LUoaZGbMvS18wSHJ2sBP9O6IJeP8HmhsXKSg3blmSyAtuxo0dJWyYz5RKTpRIp0/LJSobA0PEVGfOWxUQuRyGZYr/TEVJ6yt9xq9Bo1rm10ODW7RwPnLcwMh5eVyI0PfgD8n1laoFf32p6i2zmgIceHublN0r86IcrvP7Gqzz9zIeYmh6PQHZiQiPH3+h4Awewvr7ON7/5Tb7xjW8wPz8fbYeEGTf+FZYU4dTtzTffZHR0lErFL33CWjfuZRIP7HhAhlvhuVyOwcFBpqamooZxbW2N3d1dNjc32d7ejur7EIWJr3eF4jLh3mDcfjl8jY7jcOXKlWhU/5nPfIaZmZkPrPQIX3ev1+P27Xl+8dIv2N1Z5+MfH+XJx0oMlWt4/QaaFAhNj7KveC+laDgV5NApQhMJ6o0kd1cEm9sSM5FFCMXW9nZEGc1YCZFPJElaJobuW1cYuo7h69lITAHldIq5UoGtZgPbcSMeQ69rs7/nsLLSp91PkMo5CNHzySbq5Anhu5JIQ+xRCpSw0bU9JqcLPPRQnjfetJi/c5vX33yTSw9cYmhwyF+Pl+/ckolzksPbzs4Ozz33HN/85je5evXqkTLjJJfa+FRPSsnW1hY///nPmZqaihxl48IyJ0Fj4e9CabGQiB9m7bCEqNVqkYHPdsBOa7fbR/Sgw4siRDrC78PSKP6ce70eb731Fs1mk729PT73uc/xwAMPROzAuOfLb2Mo5au2Vnn99SvcvHGLbErjoUuDzM2Apjdw2n10zeCIaui7RUTYPwjxzl1woVBo7Oy43L5lU697DFSGUKrP3q4/aEJANmExnMuTSiQxLQtdEyQMA0MXAiV89lM2YTJXLnFjZ5eNoDlJJhMkEkl0TbG67lCtFxio2Gh6O0A4xHsM5yPEjgBEl0CTXHqPB+4b4uEHx/jxT1Z58eXXeOSxR3nmowMYuo6unyzW7Y+BG9RqdXZ3d3njjTf4zne+w61btyJMNxw5nxTMx82A+v0+S0tL/K//9b8YGBjg4x//OPl8/ggN9Hi9GtdwDmV5w1u4Bzg5ORkF4d7eHjdv3uTmzZscHByQyWQiC+SQRRc2q41Gg7t373JwcHDkeYYXoW3b3L59O2LtOY7Dgw8+GKmsxp/zv5aR6DgOi4v3ePnlV6jXqzz5+CgPPVAkm9pFeVV/IijejQDxPip1TeBKk5U1h9u3WriuIpVK0Gp1I/mHpGUyXipyeniIbCqFaRqYmo6pGxghDmhqGgXTYjibpZROsdFsCse2leO4jI2P0G43WVpusLpiMT2axtAaKCnRjlAE31vT5p8ywSRJ9UloB5ybGebpp2ZYvNNj/sY8P/3Zi5w5fZbJiXGQCtt2jhCAWq0Wi4uLXLlyhdu3b7O0tMS9e/fY3t7Gtu0jme6k7BrnL8cZfp1OhzfeeCPiTzzxxBPRnt/xDeXjdXXY4MUF0ev1erQAm06nyeVyZLO+P0gmk2F0dJTh4WHK5XKEsCilaDQaXLt2jZWVlQhhOS5JEGLSOzs7fP/7348IVI8++miEFP224Lz19U1efvlVrl9/m4GBBB/+6BTnzhmYYh+cDpquvfcQFieEfLhyJXSa7SzLK31W1noILU2r1aRWrUV3raSy4vTgEGPFAqZ5yEWXSmKI8GhSHpauMZrLMFcusV5vUO/1qNZqjI6OYugWO9suV695nD2TYnwkjex1Ao5rOAWUUeX0K+G7qDLW0YQJqs9gpcMTjwyzdHeKr379TX7yox9z7vRpPv7M0+zvbTN/a56e7eC4Lu1Wi7XVFW7cvMX8/B2azUbEgjspgH+VQc/xLBuawD/33HM+1lkq8cADDxxRPDqepY9rayQSiSigNE2LxMdD+bF6vY5hGIyPjzM9PU0ul8M0zYhfHboJ1Ot1Op1OpKZ6nPAUL1d2dnb4wQ9+wM7ODn/zN3/DJz/5yQj3/s3KjwBiVR61epNXXvklzz33Y3r9Gp/69Bk+9vQwlfImyB7SU0HtrN5zF3WUDhGMETWB65ls7Zisrrm02n6kNBo1avWGn0CEoJROkk8kfMDEU6D7o3iUxIibr+lCkDFNJvN5KqkUtV5POI6j7H4PMGi3Nd64UueJDxWZGEuD10IFZCURdqlCHVI73vXlHfIJfaK4xDB2mZzK8czvlXjjaoHX37zDT579KaNjY9QP9vjWN7/N29euIywdx+nTqFVpNdv0ek40pIirfx6vdU/yGjyesUMozfM8dnZ2eOGFF5iYmCCXy3HmzJlo+PGrMn54YViWb1sXTvxChaNQXDGUUCiXyyQSCVzXjRpAKSXtdptarUa/3z9Sw79bH6CUol6v88orr0SSDM888wxDQ0NHhk3vJ1srJel1uyzeWeSnP/0p169f5ey5AT79qRkunPfQxDbK67+D/6DeT+EhQlK/j310+gkWFlwW7vSQ0qAyUGZ3Z9PnfQtBMZUUo7kcWdOkb9sY4ZaAlEhPYQihoQWq6HqwvTKezzKez7FUqyGlpF5vUCxVyGQr3FmssXAnzYP3JUmY4lClPZI3+HX6SiGEE2wxKB/akU6VVGKVcxcSfOTpGRaXu7z+xpucOX8fZ+ZmsFI57txdomO3SFgGCdPCMhOUStmong4/uONBfLwePK7hHL9vOEUMSVo/+clPGB4ejsqDEOo7fpyHjxM+Zsi6C8fVhmFEA5ZQ5KZSqRyxjAtLpFCvrl6vvyMQT7ogQ13psCF89dVX6fV6tNttnnnmGaampt5xsvyqwI4rLu0f1Hj++Rd44fkX0DSbpz8yxaOXdTLJZezOLmAHj/Wb6337baDAkwmqjRxXrvW5d69PJpMhnU4hg4tcCEE2mWQsn6eUTOLYNo4mEJgoz8N1PPT//MhDR7ipCDB0jWbfZq3RoNnrfcnzPMrlMtlcjr3dXQp5gzNn0gwMOAjVRyknNuEMGkXxzqAWR7JZPLz9zlfXCDRBxtnZgds31+k7GmcvXmRiepp2s0Gzvo8uIJ3KIqXmK+gcsyiOf/DHs9pJOnTH/22cmB/KbBmGwdDQEJlM5shF8G5Z87gXeGiGubW1RavVolwuMzY2dqRsCP1RNjc3uXHjBvfu3YtMQI/vKp7k5RJ/nIODA1ZWVmg0GpFex0mGn78qoHu9Pq+++hp///f/wM2b13j88TH+/RcnuHB6D+HdQchOIMuln4A1v/fwVgo0w6BtF7i1WOK732+ysupRrhSpHhywv7eP7TjomsZksfTlyxPjjGQzeK6HofnmU54ncR0H/T898iBxtFdJn59hex7Vbo/NZvPLnhBfSlom7U6Xeq2FpmlMT+U4c8pE09ogHQ7dtA7dj4QKrWJExAM4GYrUooUFQ5MUS0Ogsqzcq7G0sotuZZmZO00+m2H57h3qtQOEboXCDb8SOz1pvy/MiMez9fG6NAzoEGprt9sRGy6uZhrCauG/P26uGQ5Fms0mjUYD0zSjDe34wMRxHNrtNnfv3uXWrVsRH/q458rxFbKTsrZt2+zt7bG8vMzW1lY03QwvyJPEc47/+7feuso//MPXePmlF5icSvOnXzzD0x+RFNKreP1qoBagxQJahZ807yb/eajCr0XDNqF5KCPF1m6Bn79o8LPnD+j1dLLZNPfurdAMrPYGMxnx5Nws54YGsYKdxoRpYlkmUio8T6L/50cfjhKrIoCMlMLQBF3H5dbeHn3X+5IufGKJZpi4jsvQUIKLF3KkUi2EdGJ1tIgIKe+oocW7F1LhiFsoj1TSIF8oIUWW2/N7LK/sUS5XmJuZxen3WVtdoVZrBBxmdSI5592GDGF9G9bL4X3jRpvHG8ew/FhdXWVtbY2dnR36/X60DBCf9MXZemGwhjZxrVYLx3EolUpkMpkjHoiu69Ltdtnd3WV+fp7l5eVIr+64K+1JyNHxEyMM2na7zebmJktLS9FQp1gsRt4u/vN1D0/U4KK8t7rE17/xz3z/u98jkXD54z+5zB/9uyHGB9bQvG2U9ALB8aPh++59U6jPIaKkp1SgBqUrXLLcmM/wzW9XmZ/vYBgGdt+OdLINTefM0PCXnzl/jpFcHtdxMYQgYfpbLEoqPNfzAzoOD0vlV8OWYWJ7HnerNerdzpc9T34pXygwNjoSqP3YzM0VGB/z0HUH1/Z8I6AT5vji1wS0H/pa0Om6SNkmX7DIlweoNwyuXl1he6vKxPgkFy9cwHEcVldX6PW66IaGJrR3+AEeD+b4BklceuD4oOYkPnXYKIbc58XFRZaXl6OsHUJ2oZVFWM/Gvw8DLKSthhk7vJBCw5/FxUUWFxepVqvvQCferYw6HshxZajQInlzc5O7d+9GO5IhNTaVSqFpvs9OSD7a2tvi29/9Hv/4tX+iXtvmk588w7//s0kunK5iqGWk2wmelzyhN/pVqIkELaBKCBGWBOiJBLVWgRde1vje97ZptXWymSSNRotWy+87KrmseHRmmssTE6RNE8dx0QWYhokVBrTnov8fjz6EEgKpiEzDFQIlNFyl6Hsum40mrV7/S8lkgvHxUXpdm1qtTT6f5Py5DNmsi7T7vs2x0g4pgnGfll/JMtUOsRbNQakuht4nm02Qyw2xutLi6tUlXE9x/6XLzMzN0e60WF9fQ3oumibe1Qj++IcdVxKN3ycMvJMcX+NrU0IIGo0Gi4uLXL16lZs3b7KxsYHneRH2HQZpaOHW7/cjtX3P8yLSfrhF3u122dnZYWFhgVu3brG9vR2N3d/tNZ302o7bNYc/CyUUHMdhaWmJt99+m+Xl5eC0KJBOp6KeplZv8MMfPct//+//k9s3r/Lg5VH+6i/nePzhFoa6iZA1UBItdH5QRzeVxK/go/mxICMOdMTWNIrcWszw/R90ePNKk2QyRyaToFar0QkSxn1jY1/+8KlTDGazaASiP/gBHVndSQ/DN8UEpalgkTWQ3lCKYirFpZERrm3tUO32RK1aVUt375HL5eh2k/ziF1UefXiG/ONZEmYL5YkY6SSOOP/6LvfQKsPn0kq3QUpb4+IZi7/4szm6nT5XXn8B00jw+S/8IX/4p19EaJIXf/ZTer0e2Wwe13VOZJ3FhcnjKvxxQtC74cvxzB/nMgshaDabXLlyhfn5eV588UXOnTvHqVOnIgnc8P6hnFfoJb68vBzZzYVbKOvr69FgKPT0frdT53gj+24X80kjbM+TbG/v8NxPf8rCwgKvv/4aTzz+BA8//AiFUoWbN27xnW9+l2tvvcnsdIbPfXKExy73yCTW8drVwGMQwPMpRkfEYn5VftZAaj5MK8J+A6RuUqsnuXLF4c03ajiuopxJ0G77YjKelFSyWXF6aJDZSoWEaSFdB8vQ8Fwflw69lAUahieDTKRkMHJVuNLD9lyk55EzLWaKRdbrDVp9m72DKoViEakMbtza5/mX2pw5lWB6OoXTaKHpQbEfAOaRtumva3Pxgive99GQ0kOIA3LpBE88dpqDgynqtTqvvvpT0sU0n/70J/nk738W6di8+urLtNr1APmQv7ZJDEuBcGAR50Ufb5aOB0fYVIZDi06nE/E07t27x9DQULQNHvKcw+wcl9BVSkUDlXDxNpwqnoSYxFe2TkJ0Trrv8Y1zIQRWIoHrSqQnWVleY3tzm7uLi/Q9j3MXLvPiL17njdffYLiS4C+++BCf/bTFUGkdr7uOL2MhjoqJqneZ/J3QOil0UCYoGSFjQqRYWdF57Y0Wq+t9Muksdr/L9vaOL1ipacwNDnBqcJBUIkFCN3CUxEPzx3hBmRT+JaPb6wX+GBIVNISelNiei+3505fT5RIbjTrXd/aE4ziq0+5gmCY9L8PLr+7yoScGGZ/MgdGMZdv3rvd/xCVDhVW1BjgI9ijmEjzz9CC9/hn+6/+4w/PP/hg8ydNPf4RPf+6PMCyDV156KVitstB1A6XkEfTipMaQ4OgKM3UcrTg+2o5nudD5KhRaNE0zEldcXV1lY2MjesxwrSqOghzXnI43peHfjO8gHq+N320wFP+3x3VACD54oQsSKcvfD7FdLMsgU8jRcVxef+sGz7/4KoVCgj/47GP80R8PMzt9B+FsIb0+mmEc7rWGyer9TLtFwIVWCk33UFqCWjXHK6+4vPFmA4kvnrm7s0Wt5usMFpIpcXFkhKly2T/lTIEuDrdeRAz/V0j0L144jys9PCn9L6XwlAqaQ4USgoRp4HiSrWaLZrf7ZVfKLw2UK2QyeTY2dsnnk5w5laNUdEC5KIlfY4W8DfWrYbsjSy/R1R7UWUh0rU+ppFMq5+n3Cizc3mP+zjJC15g7dZa5mVO4/T4bG+s4jouma2jHcOB4nRzu6qXT6ajOPe5adVLDdZyuGudUh6VL+ObGa+84NfS4eVE8kOOZNk4rPWlc/24Z/N1NjHwkSddBaJKe3SGTTfPhj3yUT33uD1Faimd//DybKzf59Kfn+Ou/nmZuahXh3kHJDppuHdbL6hCg9eFa8d53TIVCqT56UtB1i7xxpchX/6nK1WuNYI81wf7ePp1OB8PQxdnhIZ6cm2O6XEIIMDUdKT1sx0FJiWHoaIHjrud56P/+gUugaQhdB03zXbg0/3sVQjmBhVbbdthsNLBd90v5XAZN0zk4qGHbgrHRMqdPZTC0Dko6+HbmxLDp9460C0HUCQe6qOh6h1zeYnholr6TYmFhhbtLy7iuZPb0Waampuk5HbY2t7DtPolkMgrq+Icd2qQNDAxQDq76TqcTkf9ParJOggNPqlnjakfxBjM+oTzJBu54QMb1PY57fp8E150U6P4F4WeyuKJTqA2XziT50Ec+yuf+6It40uT73/4uizdf5WMfHeKLfzrIhdOb6O5NhGygoQVksqPZR7xv80Ef6VBCoBlltneG+fb3PZ57/gDX9Sm36+sbVKs+xj1dKX/50alJzgwNkU+nsAwdHYEX7L16nouuaRiaHjSZoP/Fgw+i6XpALvGppD78JpABtdQ3bNHoex7bzRZtu/9lpeSXrITFQGWA3Z0WylNcPDdIqdhF0EF6+NpmimMbCe9nT0sEoD1I2Uc3bPJlk6nZ02jGILdvbnLt+gLtbp/7HrzEIw8/hPAU66ur1KoHWMbhWDmOWIQ8i3Q6HUzEekdq13ebAB4P6LhjbHgLdw5HR0cZHR2lUChEdszx0uZ4rXucmxGWGPHsfbzcOPL8xGG21ILPSwQDKx/il0jXRdN05mZP8bk/+gK/9+k/oNtT/OC7P2Bp/i2efmqIv/yLUS5d2ET3rqOcOhq+4SUx0v77d4OPqdhJgRAWfW+IK9dzfOUfN1he6VIu+VzyjfV1XNelmE6LyxPjPDE7y2i5SMKySFkWpq6jCQ1d99W9Muk06XSSZDJBKpn0l2SFJkDzD3gRmICrAABXwRulaz6Zv+957LVaNLrdL2XSaUZHR6nWmuzuNCgVM5w6kyCT6SKdLkIzjmKT7+tdeGcmkNLX9BgZqTA2PoWSGsv31rl+fQGhmVy87xIz07Nk0in6gcJQt99FKY7IBmiaFhnxhEEdlh4RxfVdMmM8qOLBHEdSwgumUqlQLBbJZDJHlEfj1hLHL474c/xV4/TjkJ1f0WlBctIQmo/Po2l40qXX7ZBMJLj0wGU+/4U/5dEnP8rGdpVvf+Nb3LvzFk9/eJS/+etT3H9+G1PdRNr76LoJyghiQf2awcl7/Ux1PC3P4kqO7/3I5oUXdjCMLMmkydbWNu1AVXS6XPryE7MznBsboZDOYpmmT+A3dEzTIJlMkEmlSaczJJIJkpZFMpFE//PLl31QXROBYLp2OAGKWFACofkqNZZhsNtqU223vyyE/qXwA6w1+lTrLU6dKjM5pmEabaTnBtvh2vs0HToE6YUIa+ngw5PgOQ0KhQ5Tk2nSqRQ7G02uX1tia3efkbEJHnviQ0xMTdPqtKjXqpFyZyiB67ouqVSasbFRSqUSiUQiUvIMg/R4vXwcAz7eNMax51BpP3QESKVSZDKZaMASIiyhF+LxC+L44OckqurxUkaEJ6uugW4gdC0YZfgKnrlcjssPP8ynP/uHnDp7iV++cY2v/O3fsbN2nU9+fIK//ospLpzZAvsGnl0NSh4RybhFp8BvtiLgN6SA0lLsNgf54XMe3/7mDs22QalUptlssLq64itCBdn5kekpStkcCcPECoT5NU1DN3QM/ajaqxbwg/S/fPgh/xc+hnKYfZREKRkcXyJYTReYuo4tJXvtNtVW+8tSqS+NjY4gpWB1dQfTSjJ3usTAkIbTawamnoFxovhXXNhBZx1Is6MbVfJZm6GRMoXCIFubTd6+Ns/O7j5WIsuZ8xc4f/EMqYRJ9eCAXq9PMnmYJQ3ToBBkz7jIS6gw+m4DjONBfdz6OLwQwgsk9FAJgzXkgoSSuvELJ8TJwzLpeO1+HE58R5bWBErX0AwdTdNxPA/HdqiUB/jMZz/DH33xz8nmB/jRD3/ON776NWRvhS9+YZK/+rNhzs5uoMlroKpB/6JFVaIQKm5n+RvQ6TQ0oVC6QbM/wGtXCvzTPx/w2uvb5AtllHTY2tqi1+ti6bp4dGaaJ0/NMlYqkbYsP6AN3R+/BeVUCDoQqjOF1N0/f/DB6H9UxIsgCmBdj03WdL+jTJgGHddhp9Gg0+t9KZVOkkol6fVc6o0eg0M5pmdSpFM9NClRnoi0GY7Yf75Hwmm8Bvc/PJCyhxBdCnmNqZlRSpVh9vZ63Lq+xK35Jfq2zfTUOI898giTkxO4jsP+nq+QpJTA0HUsy6BYKlHIF0gkEtEIOr4ce5xHEW/sQg5zuFgQD8aQbNTv9+n1epHafz6fj4YpnU7nyDZKeNqFY/I4jHgSPHf4XIR/FBs6KOi1OzQbDTLpJI8/8gh/+idf5KmnP8Z+vc23/+W7vPizHzIy4PIXf3aKP/lCitMz62juIp5dC7Bh7V+5SHV0SUBKF2EplJ7nzsoA//i1Os8+u4lSGrlclur+LgcH+5iazumhoS9/5PQc50aGSFkJUqaJZRoYQe0cJtgIZwhP0ABE1P/qkUf8jjjSX/N3+DTDwNANTMsMPigruk/aSmAaOvVuj6167cvtbudLhVyObC7P3l6Nbl8xOppjeiqJQQcl3eD4+tU6G+I9JmsVklukh6BDviCYmhlhdGQcpy9YXFzlrStX2d3ZY2xigvsfvMzMzCwJ06LValOvN3wNZiSVgQojQ8Okkkl6QfDFSfXxzHgcjgv5EiEWHS8V4vTOkIQUlhNhBu/3+1HZEfcTDy+WOKR3HGMO0RT/ZwLPdem3Ozi9PulkhnPnzvLJ3/89PvXpzzI+PcsbV27w9a9+nbu33+DBS0n+49+c5XOfTTM2tITXv4vrdPyaOSoN1bvSf9/7saqhpALhoSXz1Jsj/PDHin/+5xUODjwmJofptjtsbm1j2w4D2ax46tQc942PUEilsAyTlOUHtK5paHqQGGNPRA9ef5gm9f/01JNYpoVlJTBNK/gy0Q39CISk6XrUnmmaTtqyUAI26nXqrfaXLcv6UiadwXUUOzttlDSZnCxSqfTR9S6e6x7W5iIO6Kl3EJV+FYXJDzAZKflomsRzm2RSfaanC0zPjpBMWmxv7XPr9iK3Fu7iCp3zF+7n0n2XqJQHfG5yp03f6SMQpAM6qBeMqtvtNv1+PxqMHNoZy0Dpxw/kYrEYoRnJZBLHcd6RUePBH9JRw5ImzOAhDySZTB7Jzid5Hr7TISC4yFyJaZiMDo/woY88zZ/8+z/nyac/Rrvv8c/f/C5f/+pX6LfW+MLnT/Of/uMpHn+4Rsq4Dt4OmpIBsiUPN49OCGXxPutmpfyJsW4m6PXHePWNAl/92iZLSz0qlQESyRSbGxs0Gg0yiYS4f3yMR6YmGSkUSBgmSdPwk4VmBMOUo9i3Jo69H4D+nz/yET+rxHFXTfOnhlIipfJVyqTEc11cz6Xv2AgB6YSFaRps1WocNBpftkzzS2Pj41QPWizerZJIZLh4X55cro9ndzAMM8bGOwq2h/RFQQjcn1y0RUB+QFMVmkIIByFrmGKXUsHm7LlB5uZm8HoWV99a5PXXrrC6vk6+VOYjH/sIH336IwwMDfjq8/fu0e/1qFQqDAwMYFkWnU7Hp3radhTkrutiWb5PYLFYpFAoMDQ0xOzsLGNjYxGpPlzROglvDr26w6wc1u6hDXIo6Rv+vZOIVf4pYASZv0+/b+N6kuGRMX7vk7/PX/6Hv+b3fv8ziGSWn734Kl/72j/x9usvcOF0gv/jby7wR5/PcWZ2g4R2G03uIAJ1KiFi6vlKC3qeWHP+vosNicJFCXDEEG/dKPLVr9V5/oUt8vlBsrkUd+8uUT04IKkb4vLUJE+fPcPMwACZRIJUIMSvG365EU46owDWgq9wyBOUSobrusiYvrPrunhSRnoYjuv4AR4enSoc4QpK6QyXJiZYPajy2tISm9vbpNIphkeG2dzc5pvfuseZMxf5/GdHyaU93G4bTY+5H6lfRc36dXNUdShMgonyunjsYBkOMxOKgcoUU+NnOHs2w/d/eJs3XvoZm6vr3Lt3l6c+/BRPfOjDXDx/kXuLd9hYX/Mzv1SRDK5hGEilsKwE+XwOy7TIZrMUiiUSCSuSBGu1WlED6Gd0L3jvj3p8h3wR1/U5MoZhkMv59XS/34vKPc918Vwv2IIOppGafxG7rofjHGLmxWKeublZ7rv/Mo88/gSnz53H9RSvvPEWzz37M27fuk4+6/LHn5/lc58p8+Blh0L6DsrexnP6vjuVLhF4QSCLQ90UcSKK/B4nCP7JoWkansizvF7h2z9s8YP/dZduzyBfIHIZU0oxNVDm8uQEp4eHSBmGv4USoBr6CQ1wWHaIEzowox/Ud2FmdlwPN9xjAx96CiZMjuv6CjWGAYaBjmA4l+PR2Rka3Q7z2ztiZWVN3XffeYaHh9jf3+Kf/2WHwYFhPvbhUQxzFSVtf6lRaLGX/5v4yIYB7T83oRtoKKTsYreXSFl1Hn98krnZUR56aIDvfm+NF36xzN/99//Ocz95no9//GN8/KNP8dRTH8Z2+tTrNbqdjr8lojxa7SaJZIJMOkOxmCeV9n0BlYRut0e706FRr+O4vYB34te0juNi2/0o88aztQpMc1wp8Tw3kFrLYtt9Ot0O/X4XTzpougSh8DyHXq+L47qAIplMUC6VGBwcYmp6losXLnD2wnkmJudwJbz19k1+/rOXeOvN11DOAQ9dqvCZT9/HJz9eZnx8HZxruN1tlKeha1mEMFCii8IDDP719tTBZFK56JpCmHka7TF+9FyfH/5wk05XY3Cw4ks0b276Iu+5rHhkdorzoyN+Rsb3TdED+FgPSglNHFvvOiZwJAL+kCFlOEFTaDqHFgGoiJIXDAv90akALUA7hK6TwOSBiQls18XxPDYaTbG4dE/NTU0zOjrFlSuLfO2fFPncGI9cGkJnB+n2/cbO31yPeLWRDBpHu/p3qBUdx0WEC5pAEylfyNWTuM4uymtSylX41O+d4vz5+3nk50N8/wcLXHnrFn/3327x7I++xyOPPc4zH/8Ylx98gFI+T7vTolguMjA4QKPeREmF4/bp9jrUa3U2N7apVut0ul1suwe4mIZJLleMfFBaLRF5dcefv19P+y/Utvt0Oi0MQ0cpjX6vT6NVx3G84PhXgSK9Riabo1jKMzE5wcWL93HxvsucOX2eUnmQWqvLtZsL/PS553j15efpd/a5cHaQz332QT79qSHmZmwMdQO7sYSutdD0dCQ5oJRNYA982M+8Y4jy3ulHAaaBQIKRptYe5JU3Enz3e6tsrPeZnJj0FyVqdfr9PuVsVnz4zGmePD3HaKEIyteHMbQAcz4BKxQhlzOIFZ+XfXg3w29WfIadCLKy9HxBc93SfaJPVHj7XFhD9xcThaYjNY2irnN5cpJ2r8e33nqLarUmGsWCSsssnY7Gs8/tkc0lSaWKXJhz0PQDpOuia+FIWr0jiH+l/AEKpQW741KhPA1kCWlUcKWNrhroNEF2EJqNpTc5PzPE2NAAjz58jldfH+Onz63z6msr/MvXl3j55Zd46OHHeeyxR7nv/nOcOXOeC+fuo9lssra6yq1bN7h2bZPbt2+zsrKK63qB33aCRCJDNpshm81FiEcikYhgudBC4pAX4vmIRL9PrV7F9SSOLalX67QCXFroGlZCZ3CwzMX77uPxRx/l8oMPMTIxCZpFtdZi/u4yV77xA966epXVe4ukjC6P3D/I0x+9n8cezTE7XaOcewtd1JBOA11TICq4XgkpBYImhl5FKDds9WPvvXof9V9sEKZcPNlHGBla/UleebPIf/tvSyzecRgcHER6LveWlmg26mQTlrg8McFjM7MM5fIIwDIMTF3DCPZRY+YsxK81JYjKsCi1hTH6vf/P/5der48XrAeFm8earpOwLDq9nq+KIwSOYx9qYJgmuqmDbtD3XGzXZW3/gB9eu84v7i7iChgdHlbZTJ6d3T0qFY3/8Nfn+Ju/LjE+vIbbWvelE/QA+JbBMrv4VQMYLcpcYWxLV2AYJQ4ak1xfyLC5tc/Fs0nOn26j5BK66qOURDctSBWAAWqNIvOLCX7xSpsXX1jnjTc22d93yOQrTE1PcN/FC5w7d4bxsXGy2QyggvWrFTY3Ntnb36Feq1JvtOl2Aw6Icun1eziOGxOV6dDrdSMELITiNCEwTJ1k0iKVymIaSRJmgnyhwOjoGNMzM4xPjjE0UmF4dJhKcQipdJbXtrj69nWuvf02i3fmadR2KecVZ08V+dATA3z4IyXuv2BRLLZAbqL6Wziubw9hmpMc7E/zxhWPdq/P+fOK82c6KGcVKW00zf/sj9al6j0Hs3+yuwhDp69O8fKVIf7uKzv85MdLeNKgkMtwUK2yvrEOCnH/xDife+ABzo2MkEskMHSdlKH7XA0CXN7QoqGfX7oF9bPmx4imDtUFwlPQ0IK5vwj4DlIpRIB6HEUkDmGSiKur+fi1f3xJhgt5PnL2DI7n8sule2xu74rJcVMNDQ9Qrzf59nfWKVfy/NHnJhkdkKj+Gkq5KKEFSqa/bk1LIXFA+lRNTYDQUki9zJ3VNP/0L/ss3N7mDz5ziqHhCQYHmmCvo2wXt+fi2Q10Y5dipsLjj4xx8fwgT3/4fl59dYrXXtvmxs097i29xfW3r5BMFhgbG2NubpozZ08zPDzE4MAI01OzIDza3Tb1RotOJ+CTuzbNRp1Wqx1RGfv9Ht1uFxHqdAQbI4ZpkslkSKVSAb6qk0lnqZQHKBQrPr9EF7S7Xa5dvcP6+sssLi6zuHiHanUTy+gyNpriqd8f4aOPjfDoQ0Vm5mxy+W2Et4HdrKGkEzE9TSuP4w5zcz7HV/9pkf1Ggy/88SRTM+OkzT1Ur4XneAihB5/Fe2RsiGC4Ln19Fs00cY1hrt8s8U9f3+XZnywhtARJS2dnZ5ed/T0EQpweGuKp06eZHRggaZqYhkHSsjCFwBA+ruxXBUS2nUrKQALGnwz6VfHRGQH+cvdhVgyxvLjswOGD++y7I5xbfLJ1Qvd3uixdZ6SQ55nz5zE0nRfv3GFlZVVcvHhRjQ0Ps7a6xn/7b9fxvPP88b8bZrS4jyabuFKiNB3tiBh2DJOO+zFqAoFPzhe6jhIl9upFXnurxU+fv8PWVoNcIcH5+87xzNNTGMkWmmgiMNDwUNLD6x1Ar0rSzPDAfeNcvDjFF/54isXFPq9f2eXllze4dm2H9fVr3L79Bj/+cYJMOsfAwDCnT5/m7PmzTExPMjw5SS6Xo1wsk04mcPt9esGk0d//dPGiSRbBIqdE6DpWMo2hm3Q7bWq1Kr1eh37fZXt3h9u3b7Ewf5ut7W0a9TpS2liWYGgwySefGeLxxy/y8MNDnDltMVRqY7KMdLaQnQYKB8MQgcyDwJMGaGOsbmZ5/hc7vPTLe9SaLYbHctx3X4mH7hvCSPSQvT6abvqWECqwkwhkKN49uhVKeiip0DWLnlfk1lKWr31jk2ef3aTXk1QGMnQ7LWr1GkgpZioVPnX/fVyemiSh66QMg6Tp+80L5XuH+9WZOuR/RPSAAEaOcHq/PA5nAyJobX2uRjiBCjvKkBQkCPQXDnvFOL0iJIxI5aGkpJhOY+g6T545BUrywp1F7izdFWfnTqvhkXEWF+/y//u/X6PVmuYv/3SMyaEdNNXE81TgShAbj6tQ3NFfERPCQtMHwSqBngaZoN3IcfOWwSuvzLN4t4pSkmvXt3j2JwOMDZ/m7NkcRr4KsovmtqB/gPRaoLloqoVwV9DFHsO5LOXLGS6ez/KZT59ibf00dxa7LNxqsXi3xvLyAVtbKzz707v89OfPkkhYmMkkmWyGgUqFUsmXBtANHaTyh0+ZNMVSCQHU61VajSYKiVTgeYpup0e1WmN/d5dWu4nt+KN0JR0sUzA0mOORy9OcPpVndibL7FyKuRnJ8FCXVOoupqgiVAtkH6FJEDqCFJqVB7MMWh7hJDmoDvHqLxv85Nl7rG7s4ynFlTd2+clEhdGhc4xPDKMZVTBsNPcA1W+gPO9dZwF+UtRBGijHQ2g20iqyeG+Y//m3db75rTVcL8X09AgH+3tsbmzS7/fFqcFBPvfAA9w3PkbaNElYpq/vrOkIKXGChWEpvWiAJqJywg9gJUNTQZ+wpkUnu5+UDULiSQQPq1iprSJVI79GkgFW6U+UtJCArwlM3UCZIDQf2pssl3BnZnA8ySt3l1haXRbnT59R4+OTrK6u8JWvLGOZp/nTP5xicmwX0d9DStdXMyUgQx1pFDUcJ8XeVpHVzTxb+wb7+zbLyyvcnm9z9do2ypPohmBzu8G3vnOD9Y0Gl+4vMT6VoVw0GS17zE4kyeZ6/muSAs+zQfURooZpJilmMxRLJc7MZvnQwyb7ezl2dnNs7kywvOKwsNBifbXD/n6Xg2qLnd01dtbuBYR6078OpcK2PaQUWIkUoLD7PZRySaYNDM1/fZ7rZ8JUGgbLaSrlHMVimomJFNNTFlMTFtPTaYYGoFhwyWRqaFYHZBXsKrLfw1MSMBBaEiEy2HaWjeUcy5s5dg5Mdna7rKze5sobe1y/uYunBJquc3epyte/fouNrSrnzmcYGEgzUEoyVnGZGPXIZDs+B+NdNjCk8gCJZhkIc4ybd0v83VebfOOfl3HdNKNjAzTqNTY2Nmh3OuLM4BCfuP8iF8bHyCWT6JpG0jCxQkPSoL/o9/tIz41EaQ5JYTEuthBoQo8AisNqXsNQnoeSLkpKlKcFLDvPFySXMoDVfGciXRfoATaoaxqGoaNrftgZmoYI1vxdqUjqLmPFIk+dmsP1PK5ubnL33j0xNzOjpqemWV9f53/87TKKM/zpFyaZHjXw+hsoz0Mpza/nInKLQjM0PDfB+prFN7+1y4u/3GO32mHvoEG360/VLEvzq2xbsXB3h8WVPZ79eYFCvsDcZIrPPKMx8Ic6ubwZUFsD3rEmEcpDuh2k0wK2EZpG0kgxMTrAxGQRRBrXyVGtDbK/Z1CtSvb3e6yuNtivOnS7Lr1eH7vXw3E8arUO+/tNbNtDSbASGQqlNOVyhlTSwjINEgmTdEZnYEgwMZlgZDBLJp2gVMqQyxugbGynhWe3cJwurcYBlthFEz00TUfTkmiajlRhj2Fg97Ms3DL4l+/u8MpbVapNn6jU6/hm8rppolC0uz2u39pgYWmDYinDwECBC6dzfP5TSQbKKbJFG2zvSGMYoqpKumiah5bI0HWHuDlf5KtfPeCb31pHqjSTUyO0223m79zBsW0xW6nwzIVzPDg5STJhoeuaz6LT/QGKFvDxj7grBIibCDKtCAZNYZCHRCUR+iEGWdoQ+FM/Qj6p8ANVBLuEhh6QxTUReZ4YhuWjHNEUK8a1QCdpmHimh5dwGSrk+OjZMxiazmurqyx4i2JmZkoNDQ+xtrbJ3/39CkKc4U/+aILJIQ9N7OM5Hr68ghbofLiARDc9UlkJWo/tnV2WtxooTUc3EuhKROrumiZIJBO4SrG9X2Njs0raLGMmRkgk9eAiEWiaQgnPn5RpIDUdlIWSGp2eTquTpdfNoZTAsvbI5lsU8oKBsonAQqkk0ssjVQXXM7EdB8+x6fc9Gg2ber2LDLQjdVMjm0tQKKRJWhaGoWGZCl2zQauCUUW5B7Rbaaq1Ae6t5tnZFdTqCSBBMT/E2Ogg48OCUm4PXfdrRyndQDjeH1ZpRo9UWsfut1leXqfR9kgmdBKmiaeUP+nFP8mELnA9xdp6lXq9zcTYCJlCCiutwHMQKi6QKyN0SeCiaVm6/SnevDnA331lgx9+fxnXS3Lq1By1epX5hUVc2xaTpRIfO3OGS2NjJE2TtGmSMg2frB9izUGt7vdrAqVCdONwuSPs8STBEjMSND2mdBsMVlLpFJZMRHxdn6wu0XUfnvO8AJ/WteCYDoYFWvD/keqQHygGkqRpIJWF57l4SiIK8MTcDJqu8eryMjdv3hb3X7yoHnjgYW7ceJv/5///Fr3+Jf73v7rI+OAiQq7i2B0MI+HzNYTfeJhWg7nTKf7qP8xiJAr87d+/xcZ+GxmcHjLwyIuGL9LD1OG+S2N88Yun+f1PJyiVV1Cyi6YF5kUIbC9Jt5em27fwhInrZGl3x9jcHuTeMtiuYmKsz5npTYZZIJ/dwtQkQhroIokuEpimTsoMZdBgeNA/WUTgu6eCYYkWa3YF0le+9xTtpkG1OsDO7hjXbue4frvL9k6Dds9B03UKuTznz5T4yONnSM5I9PR2QPYK0B5AKZtEos4DDxf4ojNHxxP84EcLdLp9rEwaqUALFV8DgXCpFMVCio88OcNf/cUsH3rCIZc9wO330TQzqJm1IGJcPE+h6QVa7gxvXC3xP/5+m+//4C4JK8vcqVl2dnZYWr5Ht9MRU6USz5w6xfmhIdIJi0wi4WvRGX5mNgLUTPkwRcRbi16P/4SjLSpNCDSlRzGnH18gRmFks9lDoqA49I8TwfaK8kLcNyD+ezLy+vahksN1wbC5NICEruGapt/MoZgslxFCw1OKVxcXuTU/L86eOa0mJiY4OKjytX9cpF5r8yd/WOHhSzoJawO73YmIU37X2yGd3OTixTx/9mcz9O0s//TNt9jY2fc5CdrhuShdScpKcPHiGH/+7+/nDz+fYnL0LsJtIB3H35MTCiWh1cmzsX2ajc0hdqs27Y5Js5Vha8dle6+JVJLZqSyaGiSb3sbUmrQ8A9ctgjIRQqEbHobmoOlNTKONZUj/IhcCR2q4XgrpZfDcBJ6n+4u/wkdgPGmyWx3m5vwMb72dZPFeF7svSSYLJFKSg3qDvVoNF43BSoVKcYBkooop3JjIq45QEl20KRa2ePLD02BcxNDzPPf8bQ5qTQzTiiQifOhfI51O8OQTs/xvfznHpz/pkcveQ9m1GM1XAQ5SOb4PYHKAVn+Kn/3C4u+/ssxLL22RShYZGx2iVquycHeRfrcrTg8O8PjUNKcHBsgk/F3AhGmQNE1/tC3i4+xDtEET/lK2FvkbcoTSqkJxdOULi0Y+LQHGZ4T82+ghFVGHqVCHoiKBtoM6RiLSAhmxQLwGCWiaX1MnDCNoIH061GS5RDqVJGEYvLQwz7Xr18W5c+fUYKXMxtYm//DVeXZ3JvgPfz3Kk49nSGTXUfaBX+8KA6U8PK+NMJaYm83zzDMjXHlrk539GlL2SRgWUgbK08ojm07x4P1TPP2RQaamNnFbq+jq0FhdKXDcBNV6meu3h3jjzQKb23UUHlJVabfqSNXD0HX6HRGIC1q0u3Ns7w2yuZ2lWhdIT5JKSyoll6FKnYHCNrn0Lobep++ZNDujVGvD7O1nqNYNXNcgmYRKpctAqY6n+txbH+XqfIHXbu5g6RqXLxaZnUzS7nssLGncuVen2WywvqVzUE8zVPFtQfyLOIZGKAenv0c2neDBB86xt3WehcUqm7t1zKQW4Peh6pBGOZ/joQfGeOhBk1zuLrK7hucJdD0NykPhILExUxYYI2xuTfDjn0n+8WuLXLlSJZMqUCrn2dvbY2l5GWxbXBge5vGZKU5XBkjqPpc5FWTmaHAS3whSh2JwmtBQIhSQ4ZDxF5Qc6OEleUipFShfuUAIjAiYPsRjjnEnVEz85RAJQYRCBcFVFf5Y+es7uq5j6JIEZjTnN3WDbCpF4uJF8ukkv1y6x80bN8XAwAADlYrqOzY/fnadRtOj2ZzjmY+eIZdcQrf3fdsDYSCEgaH10MQqhtYlYfmTt57joSmJlP4VLqVvEJpK2JjaDsrdAc/2r7aga1ZSw7GT9LpFalXFfm0TSZdsNoUCPA+El6ZcKnJmTmd8bJ++bbKyNsy12wPcudvnoKaD0jETkkJJcW62zKWzw0xPLGEltmm2S6yunubO3TJ311z2Dxx6PTAtwdhEigunBymXTFbWFIt369hOn7NzIzz2sMH02Dr7VQPXLrG/I6i3DpDKCbg3BFixiJYnDrOcQqODwQGGnsXUQRMGjqeQnoshdJTn90WmqcjneyStHtLeQxMGKjB0EvgcGWEUsBlidWWQ73xP8ZWvLLKwsMfgwCCVcpl7y/fY2NgQxWSS8xOTXJ4YY6KQJ2kYpAyDbCJBykpgGWZANjoM6MOAjRlQqUMrZi2QYzicGMYcF3R/aTaOhhhR1xjqQ6qQlBRwJTSC5iBUWo91u6HxZtQ2BFeS8uUPTENHi4m7S6VwlGIwn+P3LlxktFjkH15+lY2NDSzLEhfOnVfrmwm+/4NF1tfbNFtP8AefeYhi5m28xgYoy8eqUxK8Ps1Og9XNfbodGz0hcPo2rlRoCQvPVTS6XWqNHZTUEaaNwg2g96C5UQJNuuQsyf3nNMZG0yhVxvGGublQZ3f/JsqVjI4nOTPXImXV2Nuf4PlfCN58ex3LsJgcG6A8kGNnr8niwgEb9wR2Zwhd17ASCbb3JnnpeY3bC/uYOYvBgSRKKDa299nca3GwM8DHnvkwhubSqP6SfKLIRKXIaGWNysA8tpzF7hdoNjwfViwmyWUdLL2DpnmBm9hheeB/Jl2EAZ6rs7iwwt7+HmgejhOoYkmFIQx04bDXPKCnDjATCTShgERQinVQeCh9FFdc5MrVDH/394t8+1s3se0kszOn8DyXhYV5dvf2xUAqxZOzs5wZGmIgmyFlmiQNk1TCIp1IkAy2tsN40eJca81v0lVMFFPTNAzd3+42DONIMIelbpihVWyJ2ghbSC2WpcOhiQwoTSLOXz6uzK+ISpPwQVUw8fMHLzqW4SMPUil/x1ApkobBpYkJ9A8JXphf4ObGBo7niqmJCXXh3EUWF9f40pef48aNS/zN/36WM2dL0F6h39hHeiX6zhBbux5rmzVct8e5MxM8dGmOdC7DzdvL/OIXNzjY73B3qUyrkwTDPir/qvzVICvZoVRaJJvfQYk0tcYYN+aTdJodNGmSSGUYG4axkRae9Li3anFnsUO7JZk6l+bJxzxGR7ZZ2zIQRoGb13e5cq1OqTzI0PAgb9/scWNhH6HpXLiQYW6qi1IZ3nq7wtWrfe4ttTh3TjI+VuYjHx4ik2xzenyfQmaVvt2n0UqzX3Po9W1GS1lGyzqFXA/d6vmqmspX9PQzteEnE+mClqLjpFhcabOyVkVIj/vvn+aByzO4fY9rb61y7foa2x2b7R0d2xkEUUPKNrbTJJkxEKlZqgen+eH3FH/791e5cmWTfG6Mcsmk1ayzs39AdX9fnBqo8KHZWc4ODVFMpTANg5RpkUkmMQ2fE2QGo//DFapwGq1iGFn4uYgTRHQO58d+mRHfLRRRwBsiBpYLpY7wTuMPowUZWcYXNuM0ltiyYkTvDFfzNYEQPk9EN/w9uGa3R9I0eerMacrZLMm33ubaxjqLridmpieZmRlXy8ub/D//9xts75zir/96mgcvpikMrIEl6B0YeLbJ+dOj5B6e5fOfHedDjxfJZlJcv5Hhwrks129UySRS9HtJUP1gaHN06dawFFl9F09t0XPK2NUSK+v7bGx2MA2L4ZESQ4M75DL77FVzbO5CpycZHhzg3IUBzpy5zXDpDuXyKbryMlvbXbb36+zsz1Iqz7Kz9zq2tDk1O8Tl+03mJm6RMEoYapK9rWE29/dZXttibNLhIx9tUkitkDM3SCQke/VTrKwMsrldJZlSzM4YjI5sUyrWsJIpPNvwyygRiCgG1E0h/HKq5wiMZJJLl6c4c67IJ39vnIcv53H7kitX8vz054O89uYGulOgVTNQgxItoUhlKniMM39zkO98v8k///Mi83f2GKiUmZwcYWl5mTvzd0Q+meCxmWken5nhzOAgKcsMEphB2vIRDV3TsAzDBwykighGhwwdX37BCwMzgILDXcmj9GERLU+EWjLECFVKgRGK3XGSNGvsiomOh1gDEqIh/jjycP7uox0B1hvJIgQcVs3nUmtCo2vbdByH2YFB/uKpJ3nl7l1+fP0av3zllzz8yMPiqaceU6+8/DJ/9z+vsHDH5X/7iwt8+lM5JqYaWAbcdybB//kfT3PfpQoPPNjF1G+A0+fc2TN89GOPceVKg6X5NYrZJvS7iIBRdqgV4f9X1zSkMml2C6ztlLi7bLOyvksml6QyUGZoaJN0ch/kINW6ZGfvgFLBBZXHshqkUjXqrRq9VpVms8nu3gH7+z3aYwma9T616gHtlomuTMqZZRLWFqWCTipj0Vipcv3WLcbG8pydvcvwwAKW0aTVOcvK2iiv/rLJvXtVTs3luHhOozJYp9uDRn0cz01QyGyRSrYQuge4/iKy4aLcFkm9xZOPZfn4J8d54kMDzIw30Z1bSAkPPTjLpz79IM89N4whXRLaLsLUkLJMvTXClbdy/OM/7vDt79yk23c5c3qWVDrL7dvzrK2tiWIqyROzs3z41ByDuZyvP2KaAZphYggNPH97R4tKgsOCNc4b0rRDWQjd8MXXdU3DCGQd4sOW40vKKjbJFj65Ka7eGCf4E81fojX+Yztyh/7ZhwQnFV4AgpgQy2Eudzzp6zQYBlqwI2a7HrlEgidmp5ksFvjhtRu88cYVNjY2xQOXH6Rerasrb85z6+Y9fvyTaf7Lf7rEh5+s8OTHanjOOpa4gum1wOuBcoAGg8VVPvbRQR5/1MBUdbzWQVAjqkhwUKFQwkXhoFSe/WqOF1/Y5tnn7rJwZ4MzZ8cp/F6OwYE2uXybxE6L2n6HW7duIl2bSulhHrk0wfDAMOubfV555Rqv/uIW1VqTyZEB8rkyt2/f5tVXX6XfP8UzHz6LgU4mZWMYVWo1lxtvX6Vv60yOXOSTH01gagJFgaWVIt/70Rbf/PZ1TCvNIw8+TKmYptsZ42dvpVlZSTM0pPHEoz0mx5sYwkYoM/gMBbgtxgb2+ZM/LGKk+6ST19DsfXD6COGBt8/YUIkv/GEJpwvZrI7LNDfuZPjOd6r8y7+8zN27DQYHx5kLtkxu3JwXdrfLxZFhHpmcYqZSJhfYEidNk4RuYBk6SSuBqRuBMDqBFIZ2VEE1ljWlpyKSkU8jdnFdf9ClBetYvkwz0YhcBIMXQzeQKvBN13S/KVQnlBAhtnd8ZyHMuN4xxcxw00QL9PAEvpmnivYTfSjQ9SRSejieh+c44Hk4fZu+3cdQktFMho+fmqNk6ixVa1y7fo2BoSFx+YH7VLXa5NlnV7l754A//KP7+cIXJnjgch5YR+4fYPdt0P3NG8PoYll1rEIKeg7StlHCQAj3yB65UuAJD09W2N8Z5fU3Frh96y62LSnm4PRUi8GSi6BPLl/l/vPj/PRnaa5fX+F7P/gluv4wMxMlFhYP+PlL82xtbaKkpNvr4GHT67XotBvs7lap1T0cNwV6GzPZxzAlrXqNXs/lYG+abieP61m49iA3byf56c9vsbS0xB989lOcOXWBW7d2mF/Y4rU3Vlha9jh3fojKyCjDIx2EvowudJAmwjMBj2RinWS+5mfufgvXcRHKRNLD7W9jJbfJDswAp9jaKPDDb9f47nfnef2NXTSynDs3iec6rG2ss7m1JTJK8eEzp3lgaoqRfJ6koaMDluFjzAndn/75A7hgtzJU4ApgBRE3SQuytiZCkpvuT0CDFT1dNzAD+S+CUTiBIlTI+PSkF2mbKKn8jRWU8ocXYXYOU3jIa4p03nwzRnkM2tNCu4zwR4HfRb/Xw3EdlFTBVowXlB4y2l30pC8iKB2HrmPTdVxGsxkGLpznxuYWv1i8Q811SU5Pi3wli6aPqu2dGv/1v77Nm2+u8Qd/MMBHP3yKU1OTJAu74Kzj9dp4jsTtt0B1fUkGXTu2wRh2uAYaJba2i7zyus38wg79fpfJyQk+9MQks9M10lYH5bnkC/t8+KkiuwezfCcFa+v7PPuzVSbGJZaVwkyUsax9+r0uyZRJLmthWTqaELge1Jsetmei4ZBJO5RK2UCGTOB50Lc9XGmxt1/g5k2He8s76LqG57m88cYCb719jevXF2h3eqTSeWy7QL+foG+nMRIGuh56PxogJJ7sQLvlZ+xoecLxpSpSkyCzbN7Lcn2+z4+fW+Mnz26ysdYmkUgyNFZBN3Tu3VsS7VqNqWyWy5MTPDYzQzGdQSqJGRjGJ00z2DbxS8nwxBeRTaB+oshjSA3VdM3vs+Lb/IEgY0TLCEoLqYhG4qHUQ7ghr+s6RlzX+IivXsxcMq4TIT2JKz2/k02nT5Ai8QPW35nr0Lf7/ppU4BIQ2ceEwuL4pO6kYaIHrL2O4yCl4vzwMDOVCm9tbPDylbdwLJMHH3pYzM7NMn/7jvr+9+e5dv2A19+4yOf/3QyPPjxOpVjAsFbR9U4ABfm1pQz0ppXSoqVW/7nqaGqA1TWLX765w+5eG9CYOTXI449VKOdXEaqBqxK4riKd2+MTnzzD+OgUV99eY7+6y8xskUx2kpdfNri3dBchBJm0IJO2SSb8o7HZ7LO53aXvJBFCI2lI0kkLTTOR0kFKv/5VKsnaGswvNGg0OkgJP3/+ZX7+81eQwqWYT3H/pVNcvn+chy4nmR7bQaOKhhmTD+gHo4ckQncjLgSagVIJHFWi0xjk7kqSn/ykxQ++v8r16zvolsX4xATJZIKN9XWxub5BMZHgY2dO88DEBMVUkoRpIqVH0jBI6P6gJCIZiWCpNRD2VCcop75jdSBMloFzrZQqogV4eDi6ix70ZQCeGxDpgpgN/VVC0Rmj3Wr54uYRgVpGK/e+xZuMmr4wuB3HIZ3JkAyswY4qYgYysJ6H57n+FasHV6wikkSQ4WhVO6zTHWWSkBLLdui7Lq6UWIbBo5NTnB4c4PbOLq+9+SYqleL82XNibnZOLdy5w1e+8iI//vHbfOITF/nTP53j8cenKOaWwF7B63bACwUjPZ8dqHSQOmguQil6roNumgwP5Bio5Ekmk1w4N8DcdJ9cuo/Apdcrs7kzzupWnnorQbmS43OfPY0QDvligrfebrC5uYzr2AwNFZkYtxgbbjM+kSJfzFKvtrl3t8peY5hRu0e/m0K6FiIwWUomNJKmjnINdnf77Ow2cZ1eEBCSgcEy990/wVNPTXDfeY2pkRYjgzsUcntYVhNdgJJG8EF7vmKoFHjKQyoNM5lFS49g9yeYv2nyv368zfd+/DbXb+5iaDlOn7lAOp3i7r0l9vf3RdE0+OipOS6NjzOSz5O2LExDjybApu6XG1rQwGnBfqerXL+MCCiyQgvFcPyNGBHbRCGQ9QpJSf7CsArUlvxlbCOmle1nfoUTSLCFF0sofi49D6NWr0elRJQ5w60AJY86HAUFUCSPFRLwOfxeCPxpXbyDDWl+0g9oKRVo8tBSIBzQKF8M0hAautDoey6eJ0kYJvlMiqyVIGsY7HQ67K6tcA9EMpHg4oX7Va9j851v3+KlX8zz4afG+eQnhnns0QGmZ/vAOnTXcdo9XFtD4CIwECo8hqtMTpj88edHOH/+PqoHBc6c8SiX72EkHH/XUU+xfZDmf/7DFlffXmd6coDP/8FlPvGx+3BswfLSAvfurmLbDmfPTnDffZLB4SUuPTDMCy8OcnCwyJ2FXV67Mksu8xj31jrcuDFPu9MkmcowUE5SybvoQtHqKLp9g2JxhDOnhnn44QEuXkhz7qxidrbBYLlOxmpg6X1QvkeklBrS0wLZtT6artATafTsIGiTtKqDXH1F8PKrDZ790du8fXULRyUoFycZGqpQa7e4uTgvMp7HfaUiZ4aGmKqUGcrmMPRgZK4UpoBEMMIORRLDNT48n2Ck6/56XqhFqMcWreM9mxYsECjl48iG7mvzhRYahmGgB8I6IYrmix15dDqdKIn2HRvXcUmYFoZt24dzcsSRwNVFsFco4k2iQBiHWyz+UMaXkToqG3XUF8QXT9ciFdJQukBEY04V8OQ00BRS9zcRpKbouS6O41LKZHj6/Dn2mi1eXVzk9s4u6aFBLMsQmIJ0P6kODly+990t3rrS4tFHK3z4yTyXLo0xOV4kn+2BqINbA7eHtAXS09G1LiMVh4EnJA9dHqbRACEOyOe2EIaLkIKE1SabaWAZBgu3Gly9ssz6RoelxfP02n1+8rPr1Oo2czOzPPPRCS6e2WOg3ODhBy7w0IMzrKzscGthnf/xt9e59tZpdncbvPDybYRu8sjlszx0qUQ+u4mudRgeLvPRp2Z49MESDz+Y5tGHNaYmumTSu2jsoIkOOhqeZ/hojfTJ9oYpEIYB5iBQotcvsLlkcOeuyeuvV3nllRoLC/vs7zYxrBylUgbDNGi1W6Kzs0u20+GhmRkuTU4ykMkE8wM/HsKsnAz+a2i679EeoRbK3zQJ+hPpekglA4X9FLrp48tKqsOeLYJ+VSQRJzQ/nlSoNHpMgerQNzLM+v5FIqW/CSR+8H/+l5gYiopU3z3pgQwA7HCTPGgYXSlJpVIUi0VMy/IDT8pgbO6bVLaaDdqt9hFx8BDSi9fQPgVSi43x/eGN47r+soEQuFLiSA9HKXqOg+NJkoaB7bm8vbHJ8/MLtITgvvvuY2J6mnvLy9y4cVPZfZtKOcsTT0zz8d+b5OHLSWammuQyO5h6DV3Y4DmgPJ9RJl1cR8eTFpoOuuGCJtEVeFJQa44wf+cyX/naLj969gaNZhtdSyCVxHVtJicH+Nzvn+P3Pym5eGaBbLrJQXOWH/9shK9+fZNXfnmddsv2M4mpkUonOHd6lH/3mbN86uNtJsevogmX7YOz1BrjWEabSmWLXGYHQ7QRSqIZgeCAMnyehe4FOSSFEhkcmaLVK7G1O8SNmxovvrDKa6+tc/delV5XUizlmZyYIJ1Oi63NLe4tLZHXNZ6YmeWBiXEyCStIZgIrqI/TiWQ06dMUWJaJABzbRkqPRCIZiRKF+dcN1smSyQSlou+cG7ImRbyuxo8Bx/GljKXne/SEI/BkIBQfoNdI6WfnarWO9DzK5RLdXg/HtkkmU4gf/V//JRhBiuiIkIDn+jW0YfhNVNjQiWBamEz6CviRfUKghUcAfreaTVrN5lFfaeFPgkLDHAU+JIN+qFUWsPfCq08zDF8lTUr6rkfPtgOExBe26XsS2/PYbjS4tbXDSqOOyOUZHB7B0g12drbU5uY6rttldrbCM0/P8MijFS5e0Jmd9sjlmyCbqN4B0j4A2Q9QAhMldF87L3C5dV2TenuIlfUZbi2kuXWnweZWN9CWS3Pf2TSXzraYGt8gn91G13t0nRS7+2e4cXuY197ssHC3Sa/fp1iyODVT5NKFJKfn9hgpr5NN+UuuPTuLIkXCdDHMHkgH5bn+JhEiGHUn0Iw0WkoHq4DXH2J9K8eNWzZX3qrxyivbvHVlm/2DNmOjE8zMzIKuc7C/LzY31jFdlzMDA8xVKgxkM2RNE1MX4EpSqSQpy8RzXNxen0I+T8JK0Ot2cG2HXC6HENCoNxAI8vk8GtDudrCsBJqpY/d72LZDKpmkUqmQzqSDuYQ/kT4k7Yf20/6WvGPb0ShbF6Eve2BjrRSO7dBqd4LlYUm+kKff7SEVpDOZYPQtfKV3pAo18RBINKFiO1yHxHmNUCNBcWR0HvtvdJEE+4C6Dobh63nIIwEdPNnI/04cOU50XccLOCCa0NABW/fo2v5xlzctLEMnZ1mYSjGcMFHpNC27y0ariTAMURkaBSno9zX1ve+u8/3vLzI8YnDxQpEHLlc4f26C0zOnGB3uQXIfVAfcHvSbSK+B9Fyk578v2WSH86eaTI0P8dhDKVrtgKqabVPKt8kk9klYNXRdopRBQuszNrBMMdfh7Ok8B/UkjhSkki7lXJ1Cdp+EtYshqkH962JqHdACHNezEBjolgaJDBgVEDlwyzTrWRavtVlc6jA/3+D6jTUW7tRpt8HQ0xRLU5QqGu1+RyyvLZM3LRJScrlUYjCVZrRUYKRUIptI0Lf7tNttpOshLBND+CevG6loHbp2qeDkVlL68hNBaanwp3m6pmHH1QS0w4mx5tM0YyPro4Etou3+mB53bBATKvjrho5yVSCtoUfAhaGFPnjimLd4yHfWAmxRiwt6CBKW5ZcTcfveY/WOFmCffsfqF/mhbK0IanPdMPwOOcC7JaCLwNAt3PgIR+qAGfiJoEwMn+BINxAvnBsZ4czoCO1en1urq3Q6PXLDw6hKkr5QtHp9sbzRpnGgqLeEWt/o8PyLTcZGdzhzpsipU2mmZzJMTJQYqkAh1yadrmEYPZ9CrQFeH9wOGe8ugyNmQApywbZxbC/gf/s0ViF1XwyFfTLWLtmxNDMTWYSQoLoI5ZdVmq6jGTpoSdD8LWiMYMLqWUg7TbefoL1vsXOQYX1Dsbba495ykzuLbe7eqbJ30MPzDIRmYXs2uawSkyMFcokk1d1dunt7FFzJUD7HubFRhgslpPAHZFJ5h/x14VuPGJoOusQ0/aZMC5wBdEWg2yIwAnF2EZy6uqEjdJ/mGVGLAwQkztIUgXdPuHrl488y1ncd9mDhya2kn8CUIGpClRD+JpXmN8NSKQwrkQh0xLRgM0UL6IP+l5/uRYxl53/pwa5hNCgMOl517KoLWXYqZvgcKpv6fBofOZUBynLEfiFAUnxRmxDl09CV9CdUfqGLpxR926YXdMCmaXJhaoqLU1NomsbCzjY31jdwhMaZiTGy9xdJWKao1Wu8ff068wtr6vmXTHLZDCPDOU6frnDqVJGpaYupqSGGhgTlgkkh6zeHhq7QtS5oe+h6F6U0dCONqeMThZQTvBArGNzEfobj0z1FAjTLdyPQNDyyeF4RaafxXAPH0Wj1PQ4aHjs7KbY3DDbWeiwu1rm9sMfqRpVms0ev10doGiNDQ5w9e0oMlMos3bvH5soq+50eZi7LwyMjjE3PYOp6NGJ2PZeEZZE2LRKGXxaaQuA6fpmQSFjBZ3QoKqRpGp4mfRqMABUE1ZFUGxkWiYi/IeJZUqlDqV5xKGUolDi0Pwk+Z6EHF0uwOOLHyeFXMEbyfx6SzZLJVLSbFW5Zh9MXJWRQ44rAmZVYLR0RqP3MHDCfVACCazHxGi38WTD5MfAJ+CG5KVofUOFqV4wnEo3bD42NQtKTMv0XLpXC1HUsx/FrbcfBRgTZRzFdKjOYySLxa/LbW9ss7e/jmRZjo5OcPntRVMoVlJTcvHGd555dUD/8QR+huRSLKUbH8gwNlhioZBgfSTAxWWBgME+5nGd8DMyEIp1KU85lEFrfL1lw/IJMqECuNrxcTVBJFAn6jkuj2qHb9qg2kmztpDioSnY266yv19na7bC332Bzs8Pebod+z0U3TTKZPGfOXmR0bFSsrCzTcx0MT1JdXqW1tEzZ0LlvcoqRUolU0iIVGLzrmkDoYOq+ob0VoBWGpvlTXMdBkxJdHBKEDrerNTShowsZmUxpIuZUFuyV+j2VjkBDDzdLwpI14tUH44fI/yTcWDmcFmqBq4RpmgH6If0s73nYroPQBboITjZdIKQ/0DFC9yQhBNLzjrChlBKxYYk49LSAQGI3DMTYUoAQJyujxVSRwuwb1eYBdZVAOBJ1qIipBWYxKjzxY9bF0vNww2NLKfQAvtGVxIgcvTQSlkkmmcRzfd+TiUSCdLmMmUxhZdN0lMLrtel4HoauURgaFslkBqUEju2wstFS61sdkqZNv9/ANCWZtEEmIyjkfe5IIpmkkM9iGirIwo6fIDR5iGiGsKSwUBjYtkuj3qLbduj1DVodnU7Xxe5LhJZC0xP0+oDIkSkPkBZKOJ5NStfot+tU110qnoepCbJGAqtSQdkOSV1jIF+gUihgJaxgsRkMTUdDYRqG71siNAzN8DW7HembWioRrESJoGxQHN3RO6xpQ3u6qD4O6lnBYakQ7qcIIYjJkB/RfdEEyMidVov07kOpaj9b+3HlKH+K7XpuBC64noeUPkxoqCOjRxX7g8e8imMvLto6COvZOP002l45Yl4VPb465lPiCi0a7BAgKCpQQ/Vr6nDIo2Lwn+/MJKXf9fq2GSaGZWFKiS7AEj6jT+g6rufRcxz6CoSUVPJ5hktlrIRJt9Nlu1qlbftOsmeSSXLlMuVKmZ7nst9o4MgBgdCotzts7cLewQF7O02EbpC0EsG50kE3nJjr1wlCfYLgYu1GDq+u62JaCVCSdruOKz1RLhQYHypSyGcDjoMiY1mkrQSe6+E2W3TqNUSry2g+TwLIWSYDlQoCaLXbUZOtCw0rEWxaBwQfQ/e/D4PQMHSEVOhCQwt8Y/3KQguypj8HE9IHDrTIJVigqcPtE194yDd18k9TLSpBQEMJLxwMH671aTEyf3B/LayTRRgXeoB+eYGQusA0fCqwaegkLQtp6FiWGZCTYl8ipoEgYlvgftCrCG8WQmCY5tHPLdg3VBGz6oT5vVJHTC1loGgfzvD9AFaHgev6qEdkcRycVaH1ryd8e9xEwvKPn6CpdITjq6MKDS8YoVq6S1fT6LS72LaDEtDzPJLJJMVcHkPXKdeqGLYDWzs06jV63R6Tp+bIVyps1usMlsvU222anTaGZVIul4Wm+xMsgR6xEA83fTjaf6h3qnsWi0Vsu8/q2jq9vs1gLsdAJouOQEdR3d6h39ylnCswWCogEklkZZBUNusv8Pb7ANiu65d3gKnrpA2DpKGTSJiYhhkd64aho6Mhgw0eSzdQhjxU+QzrXxVk3SBri8iDPehlgtNZHGEMHyILkdtaZA8ujubHI5r/MW3FmJBMiKyJGI3ZskxSqRRSSt/QVGjR9/92+7fbv93+7fZvt3+7/dvt327/dvu327/d3t/t/wXuB5xFeICoMwAAAABJRU5ErkJggg==";

function useEmbedded(img) {    // runs when rhs-logo.png cannot be found
  if (img.src.indexOf("data:") < 0) { img.src = LOGO_SRC; }
}

function logoHtml(size) {
  return "<img src='rhs-logo.png' width='" + size + "' height='" + size + "' alt='RHS logo' style='flex:none;object-fit:contain' onerror='useEmbedded(this)'>";
}

// ----------Login, logout and menu ----------
function login() {
  var username = document.getElementById("username").value;
  var password = document.getElementById("password").value;

  me = "";
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.username === username && u.password === password) { me = u; }
  }
  if (me === "") { setMessage("Wrong username or password."); return; }

  document.getElementById("password").value = "";
  document.body.className = "in role-" + me.role;       // the role picks the colour
  chosenClass = 0;
  goTo(menuFor(me.role)[0][0]);                          // open the home page of this role
}

function forgot() {            // the "Forgot password?" link
  setMessage("Please ask the admin to reset your password.");
}

function logout() {
  me = "";
  currentPage = "";
  searchText = "";
  document.getElementById("searchBox").value = "";
  document.body.className = "out";
  setMessage("");
  show("loginPage");
}

function menuFor(role) {       // each role has its own menu: [page id, label]
  if (role === "admin") {
    return [["admHome", "Dashboard"], ["usersPage", "Users"], ["classesPage", "Classes"], ["sheetPage", "Enter Grades"],
            ["computePage", "Computing Grades"], ["schedulePage", "Schedule"], ["maintPage", "Maintenance"]];
  }
  if (role === "teacher") {
    return [["tchHome", "Home"], ["sheetPage", "Enter Grades"], ["computePage", "Computing Grades"],
            ["tchStudents", "Students"], ["schedulePage", "Schedule"]];
  }
  return [["stuHome", "Dashboard"], ["stuGrades", "My Grades"], ["schedulePage", "My Schedule"]];
}

function countMissing() {      // how many grades are not complete yet (for the bell)
  var list = [];
  if (me.role === "student") { list = classesOf(me.section); } else { list = myClasses(); }
  var count = 0;
  for (var i = 0; i < list.length; i++) {
    if (me.role === "student") {
      if (getResult(me.id, list[i].id).rating === "") { count++; }
    } else {
      var people = studentsOf(list[i].section);
      for (var j = 0; j < people.length; j++) {
        if (getResult(people[j].id, list[i].id).rating === "") { count++; }
      }
    }
  }
  return count;
}

function showBell() {
  var n = countMissing();
  if (n === 0) { setMessage("All grades are complete."); } else { setMessage(n + " grade(s) are not complete yet."); }
}

function userIcon() {          // the round person icon next to the name (SVG)
  return "<svg width='38' height='38' viewBox='0 0 24 24' style='flex:none'>" +
         "<circle cx='12' cy='12' r='10.5' fill='none' stroke='#12294d' stroke-width='1.6'/>" +
         "<circle cx='12' cy='9.5' r='3.4' fill='none' stroke='#12294d' stroke-width='1.6'/>" +
         "<path d='M5.5 19c1.2-3 3.7-4.4 6.5-4.4s5.3 1.4 6.5 4.4' fill='none' stroke='#12294d' stroke-width='1.6'/></svg>";
}

function drawMenu() {
  var items = menuFor(me.role);
  var portal = "Student Portal";
  if (me.role === "admin") { portal = "Admin Portal"; }
  if (me.role === "teacher") { portal = "Teacher Portal"; }

  var html = "<p class='brand'>" + logoHtml(62) + "<span>Rizal High School Grade System<br><small>" + portal + "</small></span></p><article class='links'>";
  var title = "";
  for (var i = 0; i < items.length; i++) {
    var css = "";
    if (items[i][0] === currentPage) { css = " class='on'"; title = items[i][1]; }
    html += "<input type='button' value='" + items[i][1] + "'" + css + " onclick=\"goTo('" + items[i][0] + "')\">";
  }
  document.getElementById("menu").innerHTML = html + "</article>";
  document.getElementById("pageTitle").innerHTML = title;
  document.getElementById("schoolYear").innerHTML = "SY " + safe(settings.schoolYear);
  document.getElementById("searchBox").className = (me.role === "student") ? "searchBox hidden" : "searchBox";

  var n = countMissing();
  var bell = "<span style='cursor:pointer' onclick='showBell()'><svg width='24' height='24' viewBox='0 0 24 24'><path d='M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6V11a6 6 0 0 0-5-5.9V4a1 1 0 0 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1z' fill='#691616'/></svg></span>" +
             (n > 0 ? "<span class='badge'>" + n + "</span>" : "");
  document.getElementById("who").innerHTML = bell +
    userIcon() +
    "<span class='name'>" + safe(me.name) + "<br><small>" + safe(me.username) + "@highschool.edu." + me.role + "</small></span>" +
    "<input type='button' value='Logout' onclick='logout()'>";
}

function searchStudent() {     // typing in the top search box shows only matching students in Enter Grades
  searchText = document.getElementById("searchBox").value.trim().toLowerCase();
  if (currentPage === "sheetPage") { showSheet(); } else { goTo("sheetPage"); }
}

function goTo(page) {          // open a page and fill it with fresh data
  currentPage = page;
  setMessage("");
  show(page);
  drawMenu();
  if (page === "stuHome")      { showStuHome(); }
  if (page === "stuGrades")    { showStuGrades(); }
  if (page === "tchHome")      { showTchHome(); }
  if (page === "tchStudents")  { showTchStudents(); }
  if (page === "sheetPage")    { loadClassOptions("sheetClass"); showSheet(); }
  if (page === "computePage")  { loadClassOptions("computeClass"); drawCompute(); }
  if (page === "schedulePage") { showSchedule(); }
  if (page === "admHome")      { showAdmHome(); }
  if (page === "usersPage")    { clearUserForm(); displayUsers(); }
  if (page === "classesPage")  { clearClassForm(); displayClasses(); }
  if (page === "maintPage")    { showMaint(); }
}

function openSheet(classId) {  // used by the Open buttons on the home pages
  chosenClass = classId;
  goTo("sheetPage");
}

// ---------- Charts(svg)----------
// labels = names under the bars ("|" starts a second line), names = series names,
// values = one list of numbers per series ("" = no bar), colors = one color per series
function barChart(labels, names, values, colors, description) {
  var w = 700, h = 320, left = 36, right = 10, top = 28, bottom = 52;
  var plotW = w - left - right;
  var plotH = h - top - bottom;
  var groupW = plotW / labels.length;
  var barW = Math.min(40, groupW * 0.75 / names.length);

  var svg = "<svg viewBox='0 0 " + w + " " + h + "' width='100%' style='max-width:" + w + "px;font-family:Arial,sans-serif' role='img' aria-label='" + safe(description) + "'>";

  for (var v = 0; v <= 100; v += 25) {                      // grid lines
    var y = top + plotH - plotH * v / 100;
    svg += "<line x1='" + left + "' y1='" + y + "' x2='" + (w - right) + "' y2='" + y + "' stroke='#e3e8ee'/>";
    svg += "<text x='" + (left - 6) + "' y='" + (y + 4) + "' font-size='11' text-anchor='end' fill='#555'>" + v + "</text>";
  }

  for (var i = 0; i < labels.length; i++) {                 // bars
    var groupX = left + i * groupW + (groupW - barW * names.length) / 2;
    for (var s = 0; s < names.length; s++) {
      var value = values[s][i];
      if (value !== "") {
        var barH = plotH * value / 100;
        var x = groupX + s * barW;
        var yTop = top + plotH - barH;
        svg += "<rect x='" + x + "' y='" + yTop + "' width='" + (barW - 2) + "' height='" + barH + "' rx='2' style='fill:" + colors[s] + "'/>";
        svg += "<text x='" + (x + (barW - 2) / 2) + "' y='" + (yTop - 4) + "' font-size='10' text-anchor='middle' fill='#333'>" + Math.round(value) + "</text>";
      }
    }
    var lines = String(labels[i]).split("|");               // names under the bars
    for (var l = 0; l < lines.length; l++) {
      svg += "<text x='" + (left + i * groupW + groupW / 2) + "' y='" + (top + plotH + 16 + l * 13) + "' font-size='11' text-anchor='middle' fill='#333'>" + safe(lines[l]) + "</text>";
    }
  }

  var passY = top + plotH - plotH * passing() / 100;        // passing line
  svg += "<line x1='" + left + "' y1='" + passY + "' x2='" + (w - right) + "' y2='" + passY + "' stroke='#c62828' stroke-width='1.5' stroke-dasharray='5 4'/>";
  svg += "<text x='" + (w - right) + "' y='" + (passY - 4) + "' font-size='10' text-anchor='end' fill='#c62828'>Passing " + passing() + "</text>";

  if (names.length > 1) {                                   // legend
    for (var k = 0; k < names.length; k++) {
      svg += "<rect x='" + (left + k * 90) + "' y='6' width='11' height='11' rx='2' style='fill:" + colors[k] + "'/>";
      svg += "<text x='" + (left + k * 90 + 16) + "' y='16' font-size='12' fill='#333'>" + safe(names[k]) + "</text>";
    }
  }
  return svg + "</svg>";
}

function hoursChart(list, elementId) {      // working hours of each day (Monday to Saturday)
  var hours = [0, 0, 0, 0, 0, 0];
  for (var i = 0; i < list.length; i++) {
    var d = DAYS.indexOf(dayOf(list[i].schedule));
    if (d >= 0) { hours[d] = hours[d] + hoursOf(list[i].schedule); }
  }
  var most = 8;                                           // the chart goes up to 8 hours or more
  for (var k = 0; k < hours.length; k++) { if (hours[k] > most) { most = hours[k]; } }

  var w = 700, h = 260, left = 36, top = 24, bottom = 30;
  var plotH = h - top - bottom;
  var groupW = (w - left - 10) / hours.length;
  var svg = "<svg viewBox='0 0 " + w + " " + h + "' width='100%' style='max-width:" + w + "px;font-family:Arial,sans-serif'>";
  for (var v = 0; v <= most; v += 2) {                    // grid lines every 2 hours
    var y = top + plotH - plotH * v / most;
    svg += "<line x1='" + left + "' y1='" + y + "' x2='" + (w - 10) + "' y2='" + y + "' stroke='#e3e8ee'/>";
    svg += "<text x='" + (left - 6) + "' y='" + (y + 4) + "' font-size='11' text-anchor='end' fill='#555'>" + v + "</text>";
  }
  for (var j = 0; j < hours.length; j++) {
    var barH = plotH * hours[j] / most;
    var x = left + j * groupW + groupW * 0.25;
    svg += "<rect x='" + x + "' y='" + (top + plotH - barH) + "' width='" + (groupW * 0.5) + "' height='" + barH + "' rx='2' style='fill:var(--red)'/>";
    if (hours[j] > 0) {
      svg += "<text x='" + (x + groupW * 0.25) + "' y='" + (top + plotH - barH - 4) + "' font-size='11' text-anchor='middle' fill='#333'>" + hours[j] + " h</text>";
    }
    svg += "<text x='" + (x + groupW * 0.25) + "' y='" + (top + plotH + 18) + "' font-size='12' text-anchor='middle' fill='#333'>" + DAY_NAMES[DAYS[j]] + "</text>";
  }
  document.getElementById(elementId).innerHTML = svg + "</svg>";
}

function drawClassTable(list, elementId) {   // one row per class with an Open button
  var html = "<tr><th>Course Code</th><th>Classes</th><th>Grade &amp; Section</th><th>Schedule</th><th>Unit</th>" +
             "<th>Students</th><th>P</th><th>F</th><th>INC</th><th></th></tr>";
  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var st = classStats(c);
    html += "<tr><td>" + safe(c.code) + "</td><td>" + safe(c.title) + "</td><td>" + safe(c.section) + "</td><td>" + safe(c.schedule) + "</td>" +
            "<td>" + c.units + "</td><td>" + st.students + "</td><td>" + st.passed + "</td><td>" + st.failed + "</td><td>" + st.inc + "</td>" +
            "<td><input type='button' value='Open Sheet' onclick='openSheet(" + c.id + ")'></td></tr>";
  }
  if (list.length === 0) { html += "<tr><td colspan='10'>No classes yet.</td></tr>"; }
  document.getElementById(elementId).innerHTML = html;
}

// ---------- Student portal ----------
function showStuHome() {
  var st = studentStats(me);
  var list = classesOf(me.section);

  document.getElementById("stuWelcome").innerHTML =
    "Welcome, <b>" + safe(me.name) + "</b> &middot; " + safe(me.program) + " &middot; Grade " + safe(me.year) + " &middot; " + safe(me.section);

  document.getElementById("stuStats").innerHTML = statsList([
    [fixed(st.average, 1), "General Average"], [st.subjects, "Subjects"],
    [st.passed, "Passed"], [st.failed, "Failed"], [st.inc, "Incomplete"]
  ]);

  var labels = [], first = [], second = [];
  for (var i = 0; i < list.length; i++) {
    var res = getResult(me.id, list[i].id);
    labels.push(list[i].code);
    first.push(res.q1);
    second.push(res.q2);
  }
  if (list.length === 0) {
    document.getElementById("stuChart1").innerHTML = "<p>You have no subjects yet.</p>";
  } else {
    document.getElementById("stuChart1").innerHTML =
      barChart(labels, ["1st Quarter", "2nd Quarter"], [first, second], ["var(--red)", "var(--dark)"], "Quarterly grade of each subject");
  }

  if (st.ww === "" && st.pt === "" && st.qa === "") {
    document.getElementById("stuChart2").innerHTML = "<p>No scores have been recorded yet.</p>";
  } else {
    document.getElementById("stuChart2").innerHTML =
      barChart(["Written Works", "Performance Task", "Quarterly Assessment"], ["Average percentage score"], [[st.ww, st.pt, st.qa]],
               ["var(--dark)"], "Your average percentage score for written works, performance tasks and quarterly assessments");
  }

  var note = "No complete grades yet. Your teacher is still recording scores.";
  if (st.best !== "") {
    note = "Best subject: <b>" + safe(st.best.code) + "</b> (" + st.best.rating + "). Lowest subject: <b>" + safe(st.worst.code) + "</b> (" + st.worst.rating + ").";
    if (st.failed > 0) { note += " <span class='bad'>You have " + st.failed + " failing subject(s). Please talk to your teacher.</span>"; }
    else { note += " <span class='good'>You are passing every graded subject.</span>"; }
  }
  document.getElementById("stuNote").innerHTML = note;
}

function showStuGrades() {
  var html = "<tr><th>Code</th><th>Subject</th><th>Schedule</th><th>Instructor</th><th>Section</th>" +
             "<th>1st Quarter</th><th>2nd Quarter</th><th>Final Grade</th><th>Descriptor</th><th>Remarks</th></tr>";
  var list = classesOf(me.section);
  var options = "";

  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var res = getResult(me.id, c.id);
    html += "<tr><td>" + safe(c.code) + "</td><td>" + safe(c.title) + "</td><td>" + safe(c.schedule) + "</td>" +
            "<td>" + safe(teacherName(c.teacherId)) + "</td><td>" + safe(c.section) + "</td>" +
            "<td>" + fixed(res.q1, 2) + "</td><td>" + fixed(res.q2, 2) + "</td>" +
            "<td><b>" + ratingText(res.rating) + "</b></td><td>" + descriptorOf(res.rating) + "</td><td>" + remarks(res.rating) + "</td></tr>";
    options += "<option value='" + c.id + "'>" + safe(c.code) + " - " + safe(c.title) + "</option>";
  }
  if (list.length === 0) { html += "<tr><td colspan='10'>You have no subjects yet.</td></tr>"; }

  var st = studentStats(me);
  document.getElementById("stuInfo").innerHTML =
    "Name: <b>" + safe(me.name) + "</b><br>Strand: <b>" + safe(me.program) + "</b><br>Grade Level: <b>" + safe(me.year) + "</b><br>" +
    "Section: <b>" + safe(me.section) + "</b><br>General Average: <b>" + fixed(st.average, 1) + "</b>";
  document.getElementById("stuTable").innerHTML = html;
  drawScale("stuScale");
  document.getElementById("detailSelect").innerHTML = options;
  showDetail();
}

function showDetail() {        // every score of one subject: total score / total items = percentage score
  var classId = Number(document.getElementById("detailSelect").value);
  var c = findClass(classId);
  var rec = getRecord(me.id, classId, false);
  var html = "<tr><th>Quarter</th>";
  for (var k = 0; k < COMPS.length; k++) { html += "<th>" + COMPS[k].name + " (" + settings.weights[COMPS[k].key] + "%)</th>"; }
  html += "<th>Quarterly Grade</th></tr>";
  if (c === "") { document.getElementById("detailTable").innerHTML = html; return; }

  for (var t = 0; t < TERMS.length; t++) {
    var data = {};
    if (rec !== "" && rec[TERMS[t][0]]) { data = rec[TERMS[t][0]]; }
    html += "<tr><td><b>" + TERMS[t][1] + "</b></td>";
    for (var i = 0; i < COMPS.length; i++) {
      var r = compOf(c, TERMS[t][0], COMPS[i], data);
      html += "<td>" + (r.any ? r.total + " / " + r.max + " = " + r.ps.toFixed(1) : "-") + "</td>";
    }
    html += "<td><b>" + fixed(termGrade(c, TERMS[t][0], data), 2) + "</b></td></tr>";
  }
  document.getElementById("detailTable").innerHTML = html;
}

// ----------Record sheet and computing grades (teacher and admin) ----------
function loadClassOptions(selectId) {     // teacher sees own classes, admin sees all
  var list = myClasses();
  var options = "";
  var found = false;
  for (var i = 0; i < list.length; i++) {
    options += "<option value='" + list[i].id + "'>" + safe(list[i].code) + " - " + safe(list[i].title) + " (" + safe(list[i].section) + ")</option>";
    if (list[i].id === chosenClass) { found = true; }
  }
  var box = document.getElementById(selectId);
  box.innerHTML = options;
  if (found) {
    box.value = chosenClass;
  } else if (list.length > 0) {
    box.selectedIndex = 0;
    chosenClass = list[0].id;
  } else {
    chosenClass = 0;
  }
}

function changeSheetClass() {  // a new class was picked, so the student list changes too
  chosenStudent = 0;
  showSheet();
}

function pickStudent(id) {     // a student was clicked in the list
  chosenStudent = id;
  showSheet();
}

function isGraded(c, term, studentId) {   // true when the quarterly grade can be computed (every score is typed)
  var rec = getRecord(studentId, c.id, false);
  if (rec === "" || !rec[term]) { return false; }
  return termGrade(c, term, rec[term]) !== "";
}

function showSheet() {         // draws the three tables (Written Works, Performance Task, Quarterly Assessment) and the student list
  var classId = Number(document.getElementById("sheetClass").value);
  var term = document.getElementById("sheetTerm").value;
  var c = findClass(classId);
  chosenClass = classId;

  if (c === "") {
    document.getElementById("sheetInfo").innerHTML = "You have no classes yet.";
    document.getElementById("sheetStats").innerHTML = "";
    document.getElementById("sheetTables").innerHTML = "";
    document.getElementById("sheetList").innerHTML = "";
    return;
  }
  var w = settings.weights;
  document.getElementById("sheetInfo").innerHTML =
    "<b>" + safe(c.section) + "</b> &middot; " + safe(c.code) + " - " + safe(c.title) + " &middot; " + safe(c.schedule) +
    "<br>Weights: Written Works " + w.ww + "% &middot; Performance Task " + w.pt + "% &middot; Quarterly Assessment " + w.qa + "%";

  // the list of students (the search box in the top bar filters it)
  var all = studentsOf(c.section);
  var shown = [];
  var found = false;
  for (var i = 0; i < all.length; i++) {
    if (all[i].id === chosenStudent) { found = true; }
    if (searchText === "" || all[i].name.toLowerCase().indexOf(searchText) >= 0) { shown.push(all[i]); }
  }
  if (!found) { chosenStudent = all.length > 0 ? all[0].id : 0; }

  var list = "<table class='roster'><tr><th>Student Name</th><th>Status</th></tr>";
  for (var j = 0; j < shown.length; j++) {
    var css = shown[j].id === chosenStudent ? " class='pick'" : "";
    list += "<tr" + css + " onclick='pickStudent(" + shown[j].id + ")'><td>" + safe(shown[j].name) + "</td><td id='rs_" + shown[j].id + "'></td></tr>";
  }
  if (shown.length === 0) { list += "<tr><td colspan='2'>No student found.</td></tr>"; }
  document.getElementById("sheetList").innerHTML = list + "</table>";

  if (chosenStudent === 0) { document.getElementById("sheetTables").innerHTML = "<p>This section has no students yet.</p>"; refreshSheet(); return; }

  // the three tables of the chosen student
  var items = getItems(c, term, false);
  var rec = getRecord(chosenStudent, c.id, false);
  var data = {};
  if (rec !== "" && rec[term]) { data = rec[term]; }

  var html = "<p>Student: <b>" + safe(findUser(chosenStudent).name) + "</b></p>";
  for (var k = 0; k < COMPS.length; k++) {
    var comp = COMPS[k];
    var head = "<td></td>";
    var itemRow = "<td>No. of Items</td>";
    var scoreRow = "<td>Student's Score</td>";
    for (var n = 1; n <= comp.count; n++) {
      var key = comp.key + n;
      head += "<td>" + n + "</td>";
      itemRow += "<td><input type='number' min='1' step='1' id='i_" + key + "' value='" + items[key] + "' onchange=\"saveItem('" + key + "')\"></td>";
      scoreRow += "<td><input type='number' min='0' max='" + items[key] + "' step='any' id='s_" + key + "' value='" +
                  (isEmpty(data[key]) ? "" : data[key]) + "' onchange=\"saveScore('" + key + "')\"></td>";
    }
    html += "<table class='score'><tr><th colspan='" + (comp.count + 4) + "'>" + comp.name + "<br>(" + w[comp.key] + "%)</th></tr>" +
            "<tr class='head'>" + head + "<td>Total</td><td>PS</td><td>WA</td></tr>" +
            "<tr class='items'>" + itemRow + "<td id='it_" + comp.key + "'></td><td>100</td><td>" + w[comp.key] + "%</td></tr>" +
            "<tr class='mine'>" + scoreRow + "<td id='st_" + comp.key + "'></td><td id='ps_" + comp.key + "'></td><td id='wa_" + comp.key + "'></td></tr></table>";
  }
  document.getElementById("sheetTables").innerHTML = html + "<p id='sheetResult'></p>";
  refreshSheet();
}

function refreshSheet() {      // recompute the totals, PS, WA, the quarterly grade, the statuses and the number boxes
  var classId = Number(document.getElementById("sheetClass").value);
  var term = document.getElementById("sheetTerm").value;
  var c = findClass(classId);
  if (c === "") { return; }

  var everyone = studentsOf(c.section);
  var gradedCount = 0;
  for (var e = 0; e < everyone.length; e++) {
    var done = isGraded(c, term, everyone[e].id);
    if (done) { gradedCount++; }
    var cell = document.getElementById("rs_" + everyone[e].id);
    if (cell) { cell.innerHTML = done ? "<span class='good'>Graded</span>" : "<span class='bad'>Not graded</span>"; }
  }
  document.getElementById("sheetStats").innerHTML = statsList([
    [everyone.length, "Students"], [gradedCount, "Graded"], [everyone.length - gradedCount, "Not Graded"]
  ]);
  if (chosenStudent === 0) { return; }

  var rec = getRecord(chosenStudent, c.id, false);
  var data = {};
  if (rec !== "" && rec[term]) { data = rec[term]; }
  for (var k = 0; k < COMPS.length; k++) {
    var r = compOf(c, term, COMPS[k], data);
    var items = getItems(c, term, false);
    var itemTotal = 0;
    for (var n = 1; n <= COMPS[k].count; n++) { itemTotal = itemTotal + Number(items[COMPS[k].key + n]); }
    document.getElementById("it_" + COMPS[k].key).innerHTML = itemTotal;
    document.getElementById("st_" + COMPS[k].key).innerHTML = r.any ? r.total : "";
    document.getElementById("ps_" + COMPS[k].key).innerHTML = r.ps === "" ? "" : r.ps.toFixed(0);
    document.getElementById("wa_" + COMPS[k].key).innerHTML = r.wa === "" ? "" : r.wa.toFixed(2);
  }
  var grade = termGrade(c, term, data);
  document.getElementById("sheetResult").innerHTML = grade === ""
    ? "Quarterly Grade: <b>-</b> (some scores are still missing)"
    : "Quarterly Grade: <b>" + grade.toFixed(2) + "</b> &rarr; " + descriptorOf(Math.round(grade)) + " &rarr; " + remarks(Math.round(grade));
}

function saveItem(key) {       // the teacher changed a "No. of Items" box. It changes the PS of every student of this class.
  var c = findClass(Number(document.getElementById("sheetClass").value));
  var term = document.getElementById("sheetTerm").value;
  var box = document.getElementById("i_" + key);
  var number = Number(box.value);
  if (box.value === "" || isNaN(number) || number < 1 || number !== Math.floor(number)) {
    box.value = getItems(c, term, false)[key];
    setMessage("The number of items must be a whole number from 1 up.");
    return;
  }
  getItems(c, term, true)[key] = number;
  document.getElementById("s_" + key).max = number;
  saveData();
  refreshSheet();
  drawMenu();
  setMessage("Number of items saved.");
}

function saveScore(key) {      // runs when a score box of the chosen student is changed
  var c = findClass(Number(document.getElementById("sheetClass").value));
  var term = document.getElementById("sheetTerm").value;
  var box = document.getElementById("s_" + key);
  var text = box.value;
  var most = getItems(c, term, false)[key];

  if (text !== "" && (isNaN(Number(text)) || Number(text) < 0 || Number(text) > most)) {
    var old = getRecord(chosenStudent, c.id, false);
    box.value = (old !== "" && old[term] && !isEmpty(old[term][key])) ? old[term][key] : "";
    setMessage("A score must be a number from 0 to " + most + " (the number of items).");
    return;
  }
  var record = getRecord(chosenStudent, c.id, true);
  record[term][key] = (text === "") ? "" : Number(text);
  saveData();
  refreshSheet();
  drawMenu();
  setMessage("Saved.");
}

function drawCompute() {       // table of 1st quarter, 2nd quarter, final grade and remarks for one class
  var classId = Number(document.getElementById("computeClass").value);
  var c = findClass(classId);
  var table = document.getElementById("computeTable");
  var studentBox = document.getElementById("computeStudent");
  var keep = studentBox.value;
  chosenClass = classId;

  if (c === "") {
    document.getElementById("computeFormula").innerHTML = "You have no classes yet.";
    table.innerHTML = "";
    studentBox.innerHTML = "";
    document.getElementById("computeSummary").innerHTML = "";
    document.getElementById("breakdownTable").innerHTML = "";
    document.getElementById("breakdownResult").innerHTML = "";
    return;
  }
  var w = settings.weights;
  document.getElementById("computeFormula").innerHTML =
    "<b>" + safe(c.code) + " - " + safe(c.title) + "</b> (" + safe(c.section) + ")<br>" +
    "PS = total score &divide; total items &times; 100<br>" +
    "Quarterly Grade = Written Works PS &times; " + w.ww + "% + Performance Task PS &times; " + w.pt + "% + Quarterly Assessment PS &times; " + w.qa + "%<br>" +
    "Final Grade = (1st Quarter + 2nd Quarter) &divide; 2 &middot; Passing grade: " + passing();

  var html = "<tr><th>Student</th><th>1st Quarter</th><th>2nd Quarter</th><th>Final Grade</th><th>Descriptor</th><th>Remarks</th></tr>";
  var options = "";
  var list = studentsOf(c.section);
  for (var i = 0; i < list.length; i++) {
    var res = getResult(list[i].id, c.id);
    html += "<tr><td>" + safe(list[i].name) + "</td><td>" + fixed(res.q1, 2) + "</td><td>" + fixed(res.q2, 2) + "</td>" +
            "<td><b>" + ratingText(res.rating) + "</b></td><td>" + descriptorOf(res.rating) + "</td><td>" + remarks(res.rating) + "</td></tr>";
    options += "<option value='" + list[i].id + "'>" + safe(list[i].name) + "</option>";
  }
  if (list.length === 0) { html += "<tr><td colspan='6'>There are no students in this section yet.</td></tr>"; }
  table.innerHTML = html;
  drawScale("scaleTable");

  var st = classStats(c);
  document.getElementById("computeSummary").innerHTML = statsList([
    [st.high === "" ? "-" : st.high, "Highest"], [fixed(st.average, 1), "Class Average"], [st.passed, "Passed"],
    [st.low === "" ? "-" : st.low, "Lowest"], [st.inc, "Incomplete"], [st.failed, "Failed"]
  ], true);

  studentBox.innerHTML = options;
  if (keep !== "") { studentBox.value = keep; }
  if (studentBox.selectedIndex < 0 && studentBox.options.length > 0) { studentBox.selectedIndex = 0; }
  drawBreakdown();
}

function drawBreakdown() {     // shows the computation step by step for one student
  var classId = Number(document.getElementById("computeClass").value);
  var studentId = Number(document.getElementById("computeStudent").value);
  var table = document.getElementById("breakdownTable");
  var c = findClass(classId);
  var rec = getRecord(studentId, classId, false);

  if (c === "" || findUser(studentId) === "") { table.innerHTML = ""; document.getElementById("breakdownResult").innerHTML = ""; return; }

  var q1 = {};
  var q2 = {};
  if (rec !== "") { if (rec.q1) { q1 = rec.q1; } if (rec.q2) { q2 = rec.q2; } }
  var w = settings.weights;

  var html = "<tr><th>Component</th><th>Weight</th><th>1st Quarter PS</th><th>1st Quarter WA</th><th>2nd Quarter PS</th><th>2nd Quarter WA</th></tr>";
  for (var i = 0; i < COMPS.length; i++) {
    var a = compOf(c, "q1", COMPS[i], q1);
    var b = compOf(c, "q2", COMPS[i], q2);
    html += "<tr><td>" + COMPS[i].name + "</td><td>" + w[COMPS[i].key] + "%</td><td>" + fixed(a.ps, 2) + "</td><td>" + fixed(a.wa, 2) + "</td>" +
            "<td>" + fixed(b.ps, 2) + "</td><td>" + fixed(b.wa, 2) + "</td></tr>";
  }
  html += "<tr class='total'><td>Quarterly Grade</td><td>" + weightTotal() + "%</td><td></td><td>" + fixed(termGrade(c, "q1", q1), 2) + "</td><td></td><td>" +
          fixed(termGrade(c, "q2", q2), 2) + "</td></tr>";
  table.innerHTML = html;

  var res = getResult(studentId, classId);
  if (res.rating === "") {
    document.getElementById("breakdownResult").innerHTML = "The final grade cannot be computed yet because a quarter is incomplete (<b>INC</b>). Fill in every score on the Enter Grades page.";
  } else {
    document.getElementById("breakdownResult").innerHTML =
      "Final Grade = (" + res.q1.toFixed(2) + " + " + res.q2.toFixed(2) + ") &divide; 2 = <b>" + res.rating + "</b> &rarr; " + descriptorOf(res.rating) + " &rarr; " + remarks(res.rating);
  }
}

// ----------Teacher portal ----------
function showTchHome() {
  var list = myClasses();
  var seen = [];                 // sections already counted
  var students = 0;
  var hours = 0, atRisk = 0, inc = 0;
  var attention = "";

  for (var i = 0; i < list.length; i++) {
    var c = list[i];
    var people = studentsOf(c.section);
    hours = hours + hoursOf(c.schedule);
    if (seen.indexOf(c.section) < 0) { seen.push(c.section); students = students + people.length; }
    for (var j = 0; j < people.length; j++) {
      var res = getResult(people[j].id, c.id);
      if (res.rating === "") {
        inc++;
      } else if (res.rating < passing()) {
        atRisk++;
        attention += "<li>" + safe(people[j].name) + " &ndash; " + safe(c.code) + " (" + safe(c.section) + "): rating <span class='bad'>" + res.rating + "</span></li>";
      }
    }
  }
  document.getElementById("tchWelcome").innerHTML = "Welcome! <b>" + safe(me.name) + "</b>";
  document.getElementById("tchStats").innerHTML = statsList([
    [list.length, "Classes"], [inc, "INC"], [atRisk, "Failing Ratings"],
    [hours, "Working Hours"], [students, "Total Students"]
  ]);
  hoursChart(list, "tchChart");
  drawClassTable(list, "tchClasses");
  document.getElementById("tchAttention").innerHTML = attention === "" ? "<p>No student is failing right now.</p>" : "<ul>" + attention + "</ul>";
}

function showTchStudents() {
  var list = myClasses();
  var html = "<tr><th>Student Name</th><th>Grade Level</th><th>Strand</th><th>Subject</th><th>General Average</th><th>Remarks</th></tr>";
  var rows = 0;
  for (var i = 0; i < list.length; i++) {
    var people = studentsOf(list[i].section);
    for (var j = 0; j < people.length; j++) {
      var res = getResult(people[j].id, list[i].id);
      html += "<tr><td>" + safe(people[j].name) + "</td><td>" + safe(people[j].year) + "</td><td>" + safe(people[j].program) + "</td>" +
              "<td>" + safe(list[i].title) + "</td><td>" + ratingText(res.rating) + "</td><td>" + remarks(res.rating) + "</td></tr>";
      rows++;
    }
  }
  if (rows === 0) { html += "<tr><td colspan='6'>You have no students yet.</td></tr>"; }
  document.getElementById("tchStudentTable").innerHTML = html;
}

// ----------Schedule (all roles) ----------
function dayOf(schedule) {     // "M (08:00 AM - 11:00 AM) - Lec" -> "M"
  var at = String(schedule).indexOf(" (");
  if (at > 0) { return String(schedule).substring(0, at); }
  return "";
}

function timeOf(schedule) {    // -> "08:00 AM - 11:00 AM"
  var a = String(schedule).indexOf("(");
  var b = String(schedule).indexOf(")");
  if (a >= 0 && b > a) { return String(schedule).substring(a + 1, b); }
  return "";
}

function minutesOf(timeText) { // start of "08:00 AM - 11:00 AM" in minutes
  var start = timeText.split(" - ")[0];
  var parts = start.split(" ");
  var hm = (parts[0] || "0:0").split(":");
  var hour = Number(hm[0]) % 12;
  if (parts[1] === "PM") { hour = hour + 12; }
  return hour * 60 + Number(hm[1] || 0);
}

function hoursOf(schedule) {   // hours of one class: "M (08:00 AM - 11:00 AM) - Lec" -> 3
  var parts = timeOf(schedule).split(" - ");
  if (parts.length < 2) { return 0; }
  return (minutesOf(parts[1]) - minutesOf(parts[0])) / 60;
}

function showSchedule() {
  var list = [];
  for (var i = 0; i < classes.length; i++) {
    var c = classes[i];
    if (me.role === "admin" || (me.role === "teacher" && c.teacherId === me.id) || (me.role === "student" && c.section === me.section)) { list.push(c); }
  }
  list.sort(function (a, b) {    // by day, then by time
    var da = DAYS.indexOf(dayOf(a.schedule));
    var db2 = DAYS.indexOf(dayOf(b.schedule));
    if (da !== db2) { return da - db2; }
    return minutesOf(timeOf(a.schedule)) - minutesOf(timeOf(b.schedule));
  });

  var titles = { admin: "All Class Schedules", teacher: "My Teaching Schedule", student: "My Class Schedule" };
  document.getElementById("schedTitle").innerHTML = titles[me.role];

  var html = "<tr><th>Day</th><th>Time</th><th>Code</th><th>Subject</th><th>Units</th><th>Section</th><th>Instructor</th></tr>";
  for (var j = 0; j < list.length; j++) {
    var day = dayOf(list[j].schedule);
    html += "<tr><td><b>" + safe(DAY_NAMES[day] || day) + "</b></td><td>" + safe(timeOf(list[j].schedule)) + "</td><td>" + safe(list[j].code) + "</td>" +
            "<td>" + safe(list[j].title) + "</td><td>" + list[j].units + "</td><td>" + safe(list[j].section) + "</td><td>" + safe(teacherName(list[j].teacherId)) + "</td></tr>";
  }
  if (list.length === 0) { html += "<tr><td colspan='7'>No classes to show.</td></tr>"; }
  document.getElementById("schedTable").innerHTML = html;
}

// ---------- Admin portal ----------
function showAdmHome() {
  var students = 0, teachers = 0, staff = 0;
  var rows = "<tr><th>Name</th><th>Position</th><th>Office Hours</th></tr>";
  for (var i = 0; i < users.length; i++) {
    var u = users[i];
    if (u.role === "student") { students++; }
    if (u.role === "teacher") { teachers++; }
    if (u.role === "admin") {
      staff++;
      rows += "<tr><td>" + safe(u.name) + "</td><td>" + safe(u.position) + "</td><td>" + safe(u.hours) + "</td></tr>";
    }
  }
  document.getElementById("admWelcome").innerHTML = "Welcome, <b>" + safe(me.name) + "</b>";
  document.getElementById("admStats").innerHTML = statsList([
    [users.length, "Users"], [students, "Students"], [teachers, "Teachers"], [staff, "Admin staff"],
    [classes.length, "Classes"], [grades.length, "Grade records"]
  ]);
  document.getElementById("admStaff").innerHTML = rows;
  drawClassTable(classes, "admClasses");
  document.getElementById("admChecks").innerHTML = adminChecks();
}

function adminChecks() {       // things the admin should fix
  var items = "";
  for (var i = 0; i < classes.length; i++) {
    var c = classes[i];
    if (findUser(c.teacherId) === "") { items += "<li>Class <b>" + safe(c.code) + "</b> (" + safe(c.section) + ") has no teacher.</li>"; }
    if (studentsOf(c.section).length === 0) { items += "<li>Class <b>" + safe(c.code) + "</b> has no students in section " + safe(c.section) + ".</li>"; }
  }
  for (var j = 0; j < users.length; j++) {
    var u = users[j];
    if (u.role === "student" && classesOf(u.section).length === 0) { items += "<li>Student <b>" + safe(u.name) + "</b> has no classes (section " + safe(u.section) + ").</li>"; }
  }
  if (items === "") { return "<p class='good'>Everything looks fine.</p>"; }
  return "<ul>" + items + "</ul>";
}

// ----- users -----
// ----- classes -----
// ----- maintenance -----
function showMaint() {
  var w = settings.weights;
  document.getElementById("wWw").value = w.ww;
  document.getElementById("wPt").value = w.pt;
  document.getElementById("wQa").value = w.qa;
  document.getElementById("wYear").value = settings.schoolYear;
  drawScale("maintScale");
  showJson();
}

function saveWeights() {
  var a = Number(document.getElementById("wWw").value);
  var p = Number(document.getElementById("wPt").value);
  var q = Number(document.getElementById("wQa").value);

  if (a < 0 || p < 0 || q < 0) { setMessage("A weight cannot be negative."); return; }
  if (a + p + q !== 100) { setMessage("The three weights must add up to 100. Now they add up to " + (a + p + q) + "."); return; }

  settings.weights = { ww: a, pt: p, qa: q };
  saveData();
  showJson();
  setMessage("Weights saved. All grades were recomputed.");
}

function saveYear() {
  var year = document.getElementById("wYear").value.trim();
  if (year === "") { setMessage("Type the school year, for example 2026-2027."); return; }
  settings.schoolYear = year;
  saveData();
  drawMenu();
  setMessage("School year saved.");
}





// ----------Start ----------

/* ===== B. SAVE AND LOAD (localStorage), same idea as  localStorage.setItem("students_db_sample", JSON.stringify(students))  =====
   Each array is saved as text with JSON.stringify and brought back with JSON.parse. */
function saveData() {
  localStorage.setItem("rhs_settings_db", JSON.stringify(settings));
  localStorage.setItem("rhs_users_db", JSON.stringify(users));
  localStorage.setItem("rhs_classes_db", JSON.stringify(classes));
  localStorage.setItem("rhs_grades_db", JSON.stringify(grades));
}
function loadData() {
  var savedSettings = localStorage.getItem("rhs_settings_db");
  var savedUsers = localStorage.getItem("rhs_users_db");
  var savedClasses = localStorage.getItem("rhs_classes_db");
  var savedGrades = localStorage.getItem("rhs_grades_db");
  if (savedSettings && savedUsers && savedClasses && savedGrades) {   // only when everything was saved before
    settings = JSON.parse(savedSettings);
    users = JSON.parse(savedUsers);
    classes = JSON.parse(savedClasses);
    grades = JSON.parse(savedGrades);
  }
}

/* ===== USERS: add, display, edit, delete (same steps as addrecords - displayStudents - deleteStudent) ===== */
var editUserIndex = -1;       // -1 = not editing. Otherwise the position of the user being edited

//Add User
function addUser() {
  var name = document.getElementById("uName").value.trim();
  var username = document.getElementById("uUser").value.trim();
  var password = document.getElementById("uPass").value.trim();
  var role = document.getElementById("uRole").value;
  if (name === "" || username === "" || password === "") {
    document.getElementById("userOutput").innerHTML = "Fill in name, username and password.";
    return;
  }
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === username) {
      document.getElementById("userOutput").innerHTML = "That username is already taken.";
      return;
    }
  }
  var newUser = { id: nextId(users), username: username, password: password, role: role, name: name };
  if (role === "student") {
    newUser.program = document.getElementById("uProgram").value.trim();
    newUser.year = document.getElementById("uYear").value.trim();
    newUser.section = document.getElementById("uSection").value.trim();
  }
  if (role === "admin") {
    newUser.position = document.getElementById("uPosition").value.trim();
    newUser.hours = document.getElementById("uHours").value.trim();
  }
  users.push(newUser);
  localStorage.setItem("rhs_users_db", JSON.stringify(users));
  document.getElementById("userOutput").innerHTML = "User added Successfully!";
  clearUserForm();
  displayUsers();
}

//Display Users
function displayUsers() {
  var table = "<tr><th>Name</th><th>Username</th><th>Password</th><th>Role</th><th>Strand</th><th>Grade Level</th><th>Section</th><th>Position</th><th>Action</th></tr>";
  for (var i = 0; i < users.length; i++) {
    table += "<tr>";
    table += "<td>" + safe(users[i].name) + "</td>";
    table += "<td>" + safe(users[i].username) + "</td>";
    table += "<td>" + safe(users[i].password) + "</td>";
    table += "<td>" + users[i].role + "</td>";
    table += "<td>" + safe(users[i].program) + "</td>";
    table += "<td>" + safe(users[i].year) + "</td>";
    table += "<td>" + safe(users[i].section) + "</td>";
    table += "<td>" + safe(users[i].position) + "</td>";
    table += "<td><input type='button' value='Edit' onclick='editUser(" + i + ")'>";
    table += "<input type='button' value='Delete' onclick='deleteUser(" + i + ")'></td>";
    table += "</tr>";
  }
  document.getElementById("userTable").innerHTML = table;
}

//Edit User: put the user into the boxes, then press Save Changes
function editUser(index) {
  var u = users[index];
  editUserIndex = index;
  document.getElementById("uName").value = u.name;
  document.getElementById("uUser").value = u.username;
  document.getElementById("uPass").value = u.password;
  document.getElementById("uRole").value = u.role;
  document.getElementById("uProgram").value = u.program || "";
  document.getElementById("uYear").value = u.year || "";
  document.getElementById("uSection").value = u.section || "";
  document.getElementById("uPosition").value = u.position || "";
  document.getElementById("uHours").value = u.hours || "";
  document.getElementById("userOutput").innerHTML = "Editing " + safe(u.name) + ". Change the boxes then press Save Changes.";
}

//Save Changes of the edited user
function saveUser() {
  if (editUserIndex < 0) {
    document.getElementById("userOutput").innerHTML = "Press Edit on a user first.";
    return;
  }
  var u = users[editUserIndex];
  var username = document.getElementById("uUser").value.trim();
  var role = document.getElementById("uRole").value;
  if (document.getElementById("uName").value.trim() === "" || username === "" || document.getElementById("uPass").value.trim() === "") {
    document.getElementById("userOutput").innerHTML = "Fill in name, username and password.";
    return;
  }
  for (var i = 0; i < users.length; i++) {
    if (users[i].username === username && i !== editUserIndex) {
      document.getElementById("userOutput").innerHTML = "That username is already taken.";
      return;
    }
  }
  if (u.id === me.id && role !== "admin") {
    document.getElementById("userOutput").innerHTML = "You cannot remove your own admin role.";
    return;
  }
  u.name = document.getElementById("uName").value.trim();
  u.username = username;
  u.password = document.getElementById("uPass").value.trim();
  u.role = role;
  if (role === "student") {
    u.program = document.getElementById("uProgram").value.trim();
    u.year = document.getElementById("uYear").value.trim();
    u.section = document.getElementById("uSection").value.trim();
  } else {
    delete u.program;
    delete u.year;
    delete u.section;
  }
  if (role === "admin") {
    u.position = document.getElementById("uPosition").value.trim();
    u.hours = document.getElementById("uHours").value.trim();
  } else {
    delete u.position;
    delete u.hours;
  }
  localStorage.setItem("rhs_users_db", JSON.stringify(users));
  document.getElementById("userOutput").innerHTML = "User updated Successfully!";
  clearUserForm();
  displayUsers();
  drawMenu();
}

//DELETE USER
function deleteUser(index) {
  if (users[index].id === me.id) {
    alert("You cannot delete your own account.");
    return;
  }
  var answer = confirm("Are you sure you want to delete " + users[index].name + "?");
  if (answer == true) {
    var removedId = users[index].id;
    users.splice(index, 1);
    for (var g = grades.length - 1; g >= 0; g--) {            // the grades of a deleted student are deleted too
      if (grades[g].studentId === removedId) { grades.splice(g, 1); }
    }
    for (var c = 0; c < classes.length; c++) {                // the classes of a deleted teacher become Unassigned
      if (classes[c].teacherId === removedId) { classes[c].teacherId = 0; }
    }
    saveData();
    alert("User deleted Successfully!");
    document.getElementById("userOutput").innerHTML = "User deleted Successfully!";
    clearUserForm();
    displayUsers();
  } else {
    alert("Delete cancelled.");
  }
}

function clearUserForm() {
  editUserIndex = -1;
  document.getElementById("uName").value = "";
  document.getElementById("uUser").value = "";
  document.getElementById("uPass").value = "";
  document.getElementById("uRole").value = "student";
  document.getElementById("uProgram").value = "";
  document.getElementById("uYear").value = "";
  document.getElementById("uSection").value = "";
  document.getElementById("uPosition").value = "";
  document.getElementById("uHours").value = "";
}

/* ===== CLASSES: add, display, edit, delete (same steps as the users above) ===== */
var editClassIndex = -1;

//Add Class
function addClass() {
  var code = document.getElementById("cCode").value.trim();
  var title = document.getElementById("cTitle").value.trim();
  var section = document.getElementById("cSection").value.trim();
  if (code === "" || title === "" || section === "") {
    document.getElementById("classOutput").innerHTML = "Fill in code, subject and section.";
    return;
  }
  classes.push({
    id: nextId(classes), code: code, title: title,
    units: Number(document.getElementById("cUnits").value),
    schedule: document.getElementById("cSchedule").value.trim(),
    lab: Number(document.getElementById("cLab").value),
    teacherId: Number(document.getElementById("cTeacher").value),
    section: section
  });
  localStorage.setItem("rhs_classes_db", JSON.stringify(classes));
  document.getElementById("classOutput").innerHTML = "Class added Successfully!";
  clearClassForm();
  displayClasses();
}

//Display Classes
function displayClasses() {
  var teachers = "<option value='0'>Unassigned</option>";       // the Teacher drop-down list
  for (var t = 0; t < users.length; t++) {
    if (users[t].role === "teacher") { teachers += "<option value='" + users[t].id + "'>" + safe(users[t].name) + "</option>"; }
  }
  var keep = document.getElementById("cTeacher").value;
  document.getElementById("cTeacher").innerHTML = teachers;
  document.getElementById("cTeacher").value = keep;
  var table = "<tr><th>Code</th><th>Subject</th><th>Units</th><th>Lab</th><th>Schedule</th><th>Section</th><th>Teacher</th><th>Action</th></tr>";
  for (var i = 0; i < classes.length; i++) {
    table += "<tr>";
    table += "<td>" + safe(classes[i].code) + "</td>";
    table += "<td>" + safe(classes[i].title) + "</td>";
    table += "<td>" + classes[i].units + "</td>";
    table += "<td>" + classes[i].lab + "</td>";
    table += "<td>" + safe(classes[i].schedule) + "</td>";
    table += "<td>" + safe(classes[i].section) + "</td>";
    table += "<td>" + safe(teacherName(classes[i].teacherId)) + "</td>";
    table += "<td><input type='button' value='Edit' onclick='editClass(" + i + ")'>";
    table += "<input type='button' value='Delete' onclick='deleteClass(" + i + ")'></td>";
    table += "</tr>";
  }
  document.getElementById("classTable").innerHTML = table;
}

//Edit Class
function editClass(index) {
  var c = classes[index];
  editClassIndex = index;
  document.getElementById("cCode").value = c.code;
  document.getElementById("cTitle").value = c.title;
  document.getElementById("cUnits").value = c.units;
  document.getElementById("cLab").value = c.lab;
  document.getElementById("cSchedule").value = c.schedule;
  document.getElementById("cSection").value = c.section;
  document.getElementById("cTeacher").value = c.teacherId;
  document.getElementById("classOutput").innerHTML = "Editing " + safe(c.code) + " (" + safe(c.section) + "). Change the boxes then press Save Changes.";
}

//Save Changes of the edited class
function saveClass() {
  if (editClassIndex < 0) {
    document.getElementById("classOutput").innerHTML = "Press Edit on a class first.";
    return;
  }
  if (document.getElementById("cCode").value.trim() === "" || document.getElementById("cTitle").value.trim() === "" ||
      document.getElementById("cSection").value.trim() === "") {
    document.getElementById("classOutput").innerHTML = "Fill in code, subject and section.";
    return;
  }
  var c = classes[editClassIndex];
  c.code = document.getElementById("cCode").value.trim();
  c.title = document.getElementById("cTitle").value.trim();
  c.units = Number(document.getElementById("cUnits").value);
  c.lab = Number(document.getElementById("cLab").value);
  c.schedule = document.getElementById("cSchedule").value.trim();
  c.section = document.getElementById("cSection").value.trim();
  c.teacherId = Number(document.getElementById("cTeacher").value);
  localStorage.setItem("rhs_classes_db", JSON.stringify(classes));
  document.getElementById("classOutput").innerHTML = "Class updated Successfully!";
  clearClassForm();
  displayClasses();
}

//DELETE CLASS
function deleteClass(index) {
  var answer = confirm("Are you sure you want to delete " + classes[index].code + " (" + classes[index].section + ") and its grades?");
  if (answer == true) {
    var removedId = classes[index].id;
    classes.splice(index, 1);
    for (var g = grades.length - 1; g >= 0; g--) {
      if (grades[g].classId === removedId) { grades.splice(g, 1); }
    }
    saveData();
    alert("Class deleted Successfully!");
    document.getElementById("classOutput").innerHTML = "Class deleted Successfully!";
    clearClassForm();
    displayClasses();
  } else {
    alert("Delete cancelled.");
  }
}

function clearClassForm() {
  editClassIndex = -1;
  document.getElementById("cCode").value = "";
  document.getElementById("cTitle").value = "";
  document.getElementById("cUnits").value = "1";
  document.getElementById("cLab").value = "0";
  document.getElementById("cSchedule").value = "";
  document.getElementById("cSection").value = "";
  document.getElementById("cTeacher").value = "0";
}

/* ===== MAINTENANCE: show / apply the JSON text and reset ===== */
function showJson() {
  var all = { settings: settings, users: users, classes: classes, grades: grades };
  document.getElementById("jsonText").value = JSON.stringify(all);
}
function applyJson() {
  var text = document.getElementById("jsonText").value;
  var data = JSON.parse(text);          // if the text is not valid JSON the browser shows an error in the console and nothing changes
  if (!Array.isArray(data.users) || !Array.isArray(data.classes) || !Array.isArray(data.grades) || !data.settings || !data.settings.scale) {
    setMessage("Invalid JSON. It needs settings, users, classes and grades.");
    return;
  }
  settings = data.settings;
  users = data.users;
  classes = data.classes;
  grades = data.grades;
  saveData();
  me = findUser(me.id);
  if (me === "" || me.role !== "admin") { logout(); return; }
  goTo("maintPage");
  setMessage("Database restored.");
}
function resetData() {
  var answer = confirm("Reset everything to the original data?");
  if (answer == true) {
    localStorage.removeItem("rhs_settings_db");
    localStorage.removeItem("rhs_users_db");
    localStorage.removeItem("rhs_classes_db");
    localStorage.removeItem("rhs_grades_db");
    alert("Original data restored. The page will reload.");
    location.reload();
  } else {
    alert("Reset cancelled.");
  }
}

/* ===== START ===== */
document.getElementById("loginLogo").innerHTML = logoHtml(130);
loadData();
show("loginPage");

