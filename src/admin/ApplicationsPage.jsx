import { useEffect, useState } from "react";
import { eventRange } from "../../shared/site-settings.js";

const statuses = {new:"Новая",in_progress:"В работе",confirmed:"Подтверждена",rejected:"Отклонена",archived:"В архиве"};
const labels = {collective:"Коллектив",performanceTitle:"Конкурсный номер",participantCount:"Участников",duration:"Хронометраж",nomination:"Номинация",ageCategory:"Возраст",professionalLevel:"Уровень",participants:"Состав участников",institution:"Учреждение",country:"Страна",city:"Город",director:"Руководитель",teacher:"Педагог",accommodation:"Проживание",hotelGuests:"Проживающие",email:"E-mail",phone:"Телефон",telegram:"Telegram",comment:"Комментарий",regulationsAccepted:"Положение принято",personalDataAccepted:"Согласие на обработку ПД"};
const dateTime = value => new Intl.DateTimeFormat("ru-RU", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(new Date(value));
const mailStatus = {pending:"Ожидает отправки",sending:"Отправляется",sent:"Отправлено",retry:"Повторная попытка по расписанию",failed:"Ошибка отправки"};

export default function ApplicationsPage({ request, csrf, fail, record, setRecord, dirty, setDirty }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const params = new URLSearchParams({search:query,status,page:String(page)}).toString();
  useEffect(() => {
    let active = true;
    setBusy(true);
    request(`/api/admin/applications?${params}`).then(value => { if (active) setList(value); })
      .catch(error => { if (active) fail(error); }).finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [params, reload]);
  const canLeave = () => !dirty || window.confirm("Есть несохранённые заметки. Уйти без сохранения?");
  async function open(id) {
    if (!canLeave()) return;
    setBusy(true); setNotice("");
    try { setRecord((await request(`/api/admin/applications/${id}`)).application); setDirty(false); }
    catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  async function save(event) {
    event.preventDefault(); setBusy(true); setNotice("");
    try {
      const value = await request(`/api/admin/applications/${record.id}`, {method:"PUT",csrf,data:{status:record.status,notes:record.notes,version:record.version}});
      setRecord(value.application); setDirty(false); setNotice("Изменения сохранены."); setReload(value => value + 1);
    } catch (error) { fail(error); }
    finally { setBusy(false); }
  }
  if (record) return <div className="cms-application-detail">
    <div className="cms-toolbar">
      <button className="cms-button" disabled={busy} onClick={() => { if (canLeave()) { setRecord(null); setDirty(false); setNotice(""); } }}>← К списку заявок</button>
      <button className="cms-text-button" disabled={busy} onClick={() => open(record.id)}>Обновить карточку</button>
    </div>
    <div className="cms-application-layout">
      <article className="cms-panel">
        <p className="cms-eyebrow">{record.number} · {dateTime(record.created_at)} МСК</p>
        <h2>{record.collective}</h2>
        <p className="cms-muted">Даты конкурса при подаче: {eventRange(record.event_snapshot.event.startDate, record.event_snapshot.event.endDate)}</p>
        <dl className="cms-application-fields">
          {Object.entries(labels).map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{record.data[key] === true ? "Да" : record.data[key] || "—"}</dd></div>)}
        </dl>
      </article>
      <form className="cms-panel cms-application-manage" onSubmit={save}>
        <h2>Работа с заявкой</h2>
        <div className="cms-status-field"><label htmlFor="application-status">Статус</label><select id="application-status" value={record.status} disabled={busy} onChange={event => {setRecord({...record,status:event.target.value});setDirty(true);}}>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <label>Заметки оргкомитета<textarea rows={8} maxLength={5000} value={record.notes} disabled={busy} onChange={event => {setRecord({...record,notes:event.target.value});setDirty(true);}} /></label>
        <small>Заметки и статус видны только администраторам.</small>
        <button className="cms-button cms-button--primary" disabled={busy || !dirty}>{busy ? "Сохраняем…" : "Сохранить заявку"}</button>
        {notice && <p className="cms-success" role="status">{notice}</p>}
        <h3>Уведомления</h3>
        {record.mail.map((item,index) => <p className="cms-mail-status" key={index}><strong>{item.recipient}</strong><span>{mailStatus[item.status] || item.status}</span></p>)}
        <small>Заявка сохранена независимо от доставки писем.</small>
      </form>
    </div>
  </div>;
  return <div>
    <div className="cms-application-counts" aria-label="Фильтр по статусу">
      {[['','Все'],...Object.entries(statuses)].map(([key,label]) => <button key={key} aria-pressed={status === key} onClick={() => {setStatus(key);setPage(1);}}><span>{label}</span><strong>{key ? list?.counts[key] || 0 : Object.values(list?.counts || {}).reduce((sum,n) => sum+n,0)}</strong></button>)}
    </div>
    <div className="cms-toolbar">
      <form className="cms-application-search" onSubmit={event => {event.preventDefault();setQuery(search);setPage(1);}}>
        <label className="cms-sr-only" htmlFor="application-search">Поиск заявок</label><input id="application-search" value={search} maxLength={180} onChange={event=>setSearch(event.target.value)} placeholder="Коллектив, город, e-mail или номер" />
        <button className="cms-button">Найти</button>
      </form>
      <a className="cms-button" href={`/api/admin/applications/export?${params}`} download>Скачать CSV</a>
      <button className="cms-button" disabled={busy} onClick={()=>setReload(value=>value+1)}>Обновить</button>
    </div>
    <div className="cms-panel cms-application-table" aria-busy={busy}>
      {busy && <p role="status">Загружаем заявки…</p>}
      {!busy && !list?.applications.length && <div className="cms-empty"><h2>{query || status ? "Ничего не найдено" : "Пока нет заявок"}</h2><p>Отправленные через сайт заявки появятся здесь.</p></div>}
      {Boolean(list?.applications.length) && <table><thead><tr><th>Заявка</th><th>Коллектив</th><th>Город</th><th>Статус</th><th>Поступила, МСК</th></tr></thead><tbody>{list.applications.map(item=><tr key={item.id}><td><button className="cms-text-button" onClick={()=>open(item.id)} disabled={busy}>{item.number}</button></td><td><strong>{item.collective}</strong><small>{item.nomination}</small></td><td>{item.city}</td><td><span className={`cms-status cms-status--${item.status}`}>{statuses[item.status]}</span></td><td>{dateTime(item.created_at)}</td></tr>)}</tbody></table>}
    </div>
    {list && <nav className="cms-pagination" aria-label="Страницы заявок"><button className="cms-button" disabled={page <= 1 || busy} onClick={()=>setPage(page-1)}>Назад</button><span>{page} / {list.pages} · всего {list.total}</span><button className="cms-button" disabled={page >= list.pages || busy} onClick={()=>setPage(page+1)}>Далее</button></nav>}
  </div>;
}
