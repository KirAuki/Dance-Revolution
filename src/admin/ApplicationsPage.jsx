import { useEffect, useState } from "react";
import { eventRange } from "../../shared/site-settings.js";

const statuses = {new:"Новая",in_progress:"В работе",confirmed:"Подтверждена",rejected:"Отклонена",archived:"В архиве"};
const labels = {collective:"Коллектив",performanceTitle:"Конкурсный номер",participantCount:"Участников",duration:"Хронометраж",nomination:"Номинация",ageCategory:"Возраст",professionalLevel:"Уровень",participants:"Состав участников",institution:"Учреждение",country:"Страна",city:"Город",director:"Руководитель",teacher:"Педагог",accommodation:"Проживание",hotelGuests:"Проживающие",email:"E-mail",phone:"Телефон",telegram:"Telegram",comment:"Комментарий",regulationsAccepted:"Положение принято",personalDataAccepted:"Согласие на обработку ПД"};
const dateTime = value => new Intl.DateTimeFormat("ru-RU", {dateStyle:"short",timeStyle:"short",timeZone:"Europe/Moscow"}).format(new Date(value));
const mailStatus = {pending:"Ожидает отправки",sending:"Отправляется",sent:"Отправлено",retry:"Повторная попытка по расписанию",failed:"Ошибка отправки"};

function fieldValue(key, value) {
  if (value === true) return "Да";
  if (!value) return "—";
  if (key === "email") return <a href={`mailto:${value}`}>{value}</a>;
  if (key === "phone") return <a href={`tel:${value.replace(/[^+\d]/g, "")}`}>{value}</a>;
  return value;
}

export default function ApplicationsPage({ request, csrf, fail, record, setRecord, dirty, setDirty }) {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState(null);
  const [loading, setLoading] = useState(false);
  const [action, setAction] = useState("");
  const [reload, setReload] = useState(0);
  const [notice, setNotice] = useState("");
  const busy = loading || Boolean(action);
  const params = new URLSearchParams({search:query,status,page:String(page)}).toString();
  useEffect(() => {
    let active = true;
    setLoading(true);
    request(`/api/admin/applications?${params}`).then(value => {
      if (active) { setList(value); setPage(value.page); }
    }).catch(error => { if (active) fail(error); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params, reload]);
  const canLeave = () => !dirty || window.confirm("Есть несохранённые заметки. Уйти без сохранения?");
  async function open(id) {
    if (!canLeave()) return;
    setAction("open"); setNotice("");
    try { setRecord((await request(`/api/admin/applications/${id}`)).application); setDirty(false); }
    catch (error) { fail(error); }
    finally { setAction(""); }
  }
  async function save(event) {
    event.preventDefault(); setAction("save"); setNotice("");
    try {
      const value = await request(`/api/admin/applications/${record.id}`, {method:"PUT",csrf,data:{status:record.status,notes:record.notes,version:record.version}});
      setRecord(value.application); setDirty(false); setNotice("Изменения сохранены."); setReload(value => value + 1);
    } catch (error) { fail(error); }
    finally { setAction(""); }
  }
  async function remove() {
    if (busy || !window.confirm(`Удалить заявку ${record.number} — «${record.collective}» навсегда?\n\nДанные заявки, заметки и связанные письма в базе будут удалены. Уже отправленные письма останутся в почтовых ящиках. Восстановления в админке нет.`)) return;
    setAction("delete"); setNotice("");
    try {
      await request(`/api/admin/applications/${record.id}`, {method:"DELETE",csrf,data:{version:record.version}});
      setNotice(`Заявка ${record.number} удалена.`);
      setRecord(null); setDirty(false); setReload(value => value + 1);
    } catch (error) { fail(error); }
    finally { setAction(""); }
  }
  async function retryMail() {
    if (busy || dirty) return;
    setAction("retry"); setNotice("");
    try {
      const value = await request(`/api/admin/applications/${record.id}/retry-mail`, {method:"POST",csrf,data:{version:record.version}});
      setRecord(value.application);
      setNotice("Неотправленные письма возвращены в очередь. Их отправит планировщик.");
    } catch (error) { fail(error); }
    finally { setAction(""); }
  }
  function resetFilters() {
    setSearch(""); setQuery(""); setStatus(""); setPage(1);
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
          {Object.entries(labels).map(([key,label]) => <div key={key}><dt>{label}</dt><dd>{fieldValue(key, record.data[key])}</dd></div>)}
        </dl>
      </article>
      <form className="cms-panel cms-application-manage" onSubmit={save}>
        <h2>Работа с заявкой</h2>
        <div className="cms-status-field"><label htmlFor="application-status">Статус</label><select id="application-status" value={record.status} disabled={busy} onChange={event => {setRecord({...record,status:event.target.value});setDirty(true);}}>{Object.entries(statuses).map(([key,label]) => <option key={key} value={key}>{label}</option>)}</select></div>
        <label>Заметки оргкомитета<textarea rows={8} maxLength={5000} value={record.notes} disabled={busy} onChange={event => {setRecord({...record,notes:event.target.value});setDirty(true);}} /></label>
        <small>Заметки и статус видны только администраторам.</small>
        <button className="cms-button cms-button--primary" disabled={busy || !dirty}>{action === "save" ? "Сохраняем…" : "Сохранить заявку"}</button>
        {notice && <p className="cms-success" role="status">{notice}</p>}
        <h3>Уведомления</h3>
        {record.mail.map((item,index) => <p className="cms-mail-status" key={index}><strong>{item.recipient}</strong><span>{mailStatus[item.status] || item.status}</span>{item.attempts > 0 && <small>Попыток в текущем цикле: {item.attempts}</small>}</p>)}
        {record.mail.some(item => ["retry", "failed"].includes(item.status)) && <div className="cms-mail-retry">
          <button type="button" className="cms-button" disabled={busy || dirty} onClick={retryMail}>{action === "retry" ? "Возвращаем в очередь…" : "Повторить отправку писем"}</button>
          <small>{dirty ? "Сначала сохраните изменения заявки." : "Повтор касается только писем с ошибкой. Если ошибка связана с SMTP, сначала проверьте настройки почты."}</small>
        </div>}
        <small>Заявка сохранена независимо от доставки писем.</small>
        <div className="cms-application-delete">
          <h3>Удаление заявки</h3>
          <p>Чтобы сохранить историю обращения, выберите статус «В архиве». Удаление навсегда убирает заявку и связанные письма из базы.</p>
          <button type="button" className="cms-button cms-danger" disabled={busy || record.mail.some(item => item.status === "sending")} onClick={remove}>{action === "delete" ? "Удаляем…" : "Удалить заявку"}</button>
          {record.mail.some(item => item.status === "sending") && <small>Дождитесь завершения отправки письма и обновите карточку.</small>}
        </div>
      </form>
    </div>
  </div>;
  return <div>
    {notice && <p className="cms-success" role="status">{notice}</p>}
    <div className="cms-application-counts" aria-label="Фильтр по статусу">
      {[['','Все'],...Object.entries(statuses)].map(([key,label]) => <button key={key} aria-pressed={status === key} onClick={() => {setStatus(key);setPage(1);}}><span>{label}</span><strong>{key ? list?.counts[key] || 0 : Object.values(list?.counts || {}).reduce((sum,n) => sum+n,0)}</strong></button>)}
    </div>
    <div className="cms-toolbar">
      <form className="cms-application-search" onSubmit={event => {event.preventDefault();setQuery(search);setPage(1);}}>
        <label className="cms-sr-only" htmlFor="application-search">Поиск заявок</label><input id="application-search" value={search} maxLength={180} onChange={event=>setSearch(event.target.value)} placeholder="Коллектив, город, e-mail или номер" />
        <button className="cms-button">Найти</button>
      </form>
      {Boolean(search || query || status) && <button className="cms-text-button" onClick={resetFilters}>Сбросить фильтры</button>}
      <a className="cms-button" href={`/api/admin/applications/export?${params}`} download>Скачать CSV</a>
      <button className="cms-button" disabled={busy} onClick={()=>setReload(value=>value+1)}>Обновить</button>
    </div>
    <div className="cms-panel cms-application-table" aria-busy={busy}>
      {busy && <p role="status">Загружаем заявки…</p>}
      {!busy && !list?.applications.length && <div className="cms-empty"><h2>{query || status ? "Ничего не найдено" : "Пока нет заявок"}</h2><p>{query || status ? "Измените запрос или сбросьте фильтры." : "Отправленные через сайт заявки появятся здесь."}</p></div>}
      {Boolean(list?.applications.length) && <table><thead><tr><th>Заявка</th><th>Коллектив</th><th>Город</th><th>Статус</th><th>Поступила, МСК</th></tr></thead><tbody>{list.applications.map(item=><tr key={item.id}><td><button className="cms-text-button" onClick={()=>open(item.id)} disabled={busy}>{item.number}</button></td><td><strong>{item.collective}</strong><small>{item.nomination}</small></td><td>{item.city}</td><td><span className={`cms-status cms-status--${item.status}`}>{statuses[item.status]}</span></td><td>{dateTime(item.created_at)}</td></tr>)}</tbody></table>}
    </div>
    {list && <nav className="cms-pagination" aria-label="Страницы заявок"><button className="cms-button" disabled={page <= 1 || busy} onClick={()=>setPage(page-1)}>Назад</button><span>{page} / {list.pages} · всего {list.total}</span><button className="cms-button" disabled={page >= list.pages || busy} onClick={()=>setPage(page+1)}>Далее</button></nav>}
  </div>;
}
