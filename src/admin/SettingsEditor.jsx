import { useState } from "react";
import { settingsGroups, homeBlocks, eventRange, dayCount, validDate, validImage, validDocument, homepageSeo } from "../../shared/site-settings.js";
import { pageDefinitions } from "../../shared/site-pages.js";

function SettingField({ field, value, name, onChange, onUpload }) {
  const type = field.type || "text";
  if (type === "image" || type === "document") {
    const image = type === "image";
    return (
      <div className="cms-settings-file">
        <label>
          {field.label}
          <input name={name} type="file" accept={image ? "image/jpeg,image/png,image/webp" : ".pdf,.docx"}
            onChange={event => {
              const file = event.target.files[0];
              event.target.value = "";
              if (file) onUpload(file, type, onChange);
            }} />
        </label>
        {image && validImage(value) && <img src={value} className="cms-settings-image" alt={field.label} />}
        {image && field.optional && value && <button className="cms-text-button" type="button" onClick={() => onChange("")}>Убрать фотографию</button>}
        {!image && validDocument(value) && <a href={value} target="_blank" rel="noreferrer">Открыть текущее положение</a>}
        <small>{image ? "JPG, PNG или WebP, до 2 МБ." : "PDF или DOCX, до 10 МБ. После сохранения заменит все ссылки на положение."}</small>
      </div>
    );
  }
  const attributes = {
    name, required: !field.optional, value,
    maxLength: field.maxLength || (type === "email" ? 254 : type === "tel" ? 40 : 2048),
    onChange: event => onChange(type === "number" && event.target.value !== "" ? Number(event.target.value) : event.target.value),
  };
  return <label className={type === "textarea" ? "cms-settings-wide" : undefined}>
    {field.label}
    {type === "textarea" ? <textarea {...attributes} rows={field.rows || 4} /> : <input {...attributes} type={type}
      min={type === "date" ? "2000-01-01" : field.min}
      max={type === "date" ? "2099-12-31" : field.max} step={type === "number" ? 1 : undefined} />}
  </label>;
}

export default function SettingsEditor({ record, dirty, busy, onChange, onSave, onReload, onUpload }) {
  const [active, setActive] = useState("event");
  const [search, setSearch] = useState("");
  if (!record) return <div className="cms-panel"><p>Загружаем настройки сайта…</p><button className="cms-button" disabled={busy} onClick={onReload}>Повторить загрузку</button></div>;
  const settings = record.settings;
  const updateField = (group, key, value) => onChange({ ...settings, [group]: { ...settings[group], [key]: value } });
  const updateItem = (group, index, values) => onChange({ ...settings, [group]: settings[group].map((item, i) => i === index ? { ...item, ...values } : item) });
  const updatePage = (key, values) => onChange({ ...settings, pages: { ...settings.pages, [key]: { ...settings.pages[key], ...values } } });
  const updateSection = (key, index, values) => updatePage(key, { sections: settings.pages[key].sections.map((section, i) => i === index ? { ...section, ...values } : section) });
  const moveSection = (key, from, to) => {
    const sections = [...settings.pages[key].sections];
    [sections[from], sections[to]] = [sections[to], sections[from]];
    updatePage(key, { sections });
  };
  const moveJury = (from, to) => {
    const jury = [...settings.jury];
    [jury[from], jury[to]] = [jury[to], jury[from]];
    onChange({ ...settings, jury });
  };
  const updateHome = (key, values) => onChange({...settings,home:{...settings.home,[key]:{...settings.home[key],...values}}});
  const links = [
    ...settingsGroups.map(group=>({key:group.key,title:group.title})),
    {key:"program",title:"Программа"}, {key:"jury",title:"Жюри"},
    ...homeBlocks.map(block=>({key:`home-${block.key}`,title:block.title})),
    ...pageDefinitions.map(page=>({key:page.key,title:page.label})),
  ];
  const choose = key => { setActive(key); document.querySelector(".cms-settings-content")?.scrollIntoView({block:"start"}); };
  return <form className="cms-settings" noValidate onSubmit={event => { event.preventDefault(); onSave(); }}>
    <aside className="cms-settings-nav">
      <label className="cms-settings-search">Найти блок<input value={search} onChange={event=>setSearch(event.target.value)} placeholder="Например, награды" /></label>
      <nav aria-label="Разделы настроек">
        {links.filter(link=>link.title.toLowerCase().includes(search.toLowerCase())).map(link=><button type="button" key={link.key} aria-current={active === link.key ? "page" : undefined} disabled={busy} onClick={()=>choose(link.key)}>{link.title}</button>)}
      </nav>
      <div className="cms-panel cms-save">
        <p className="cms-muted" role="status">{busy ? "Выполняем запрос…" : dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}</p>
        <button className="cms-button cms-button--primary" disabled={busy || !dirty}>Сохранить настройки</button>
        <button className="cms-text-button" type="button" onClick={onReload} disabled={busy}>Загрузить сохранённую версию</button>
        <small>Изменения появятся на сайте после обновления страницы.</small>
      </div>
    </aside>
    <fieldset className="cms-settings-content" disabled={busy}>
      <div className="cms-settings-summary cms-panel">
        <h2>{validDate(settings.event.startDate) && validDate(settings.event.endDate) ? eventRange(settings.event.startDate, settings.event.endDate) : "Укажите даты конкурса"}</h2>
        <p>{settings.event.city} · {settings.venue.name}</p>
        <small>Даты программы, длительность проживания и год на сайте обновляются автоматически. Тексты программы и содержимое положения редактируются отдельно.</small>
      </div>
      {settingsGroups.filter(group=>active === group.key).map(group => <section className="cms-panel" id={`settings-${group.key}`} key={group.key}>
        <h2>{group.title}</h2>
        {group.key === "seo" && <>
          <p className="cms-muted">Title и description главной страницы попадают в HTML сразу с сервера. Вставки {"{dates}"}, {"{city}"}, {"{venue}"} и {"{year}"} подставляют даты, город, площадку и год из настроек. Поисковик может выбрать свой текст для выдачи.</p>
          <div className="cms-seo-preview" aria-label="Предпросмотр заголовка и описания">
            <strong>{homepageSeo(settings).title}</strong>
            <p>{homepageSeo(settings).description}</p>
          </div>
          <p className="cms-muted">Для подтверждения владения сайтом вставляйте только значение content из метатега Google или Яндекса. Счётчики аналитики при этом не подключаются. Заголовки и описания статей берутся из редактора публикаций.</p>
        </>}
        <div className="cms-settings-fields">
          {group.fields.map(field => <SettingField key={field.key} field={field} name={`${group.key}.${field.key}`}
            value={settings[group.key][field.key]} onChange={value => updateField(group.key, field.key, value)} onUpload={onUpload} />)}
        </div>
      </section>)}
      {active === "program" && <section className="cms-panel" id="settings-program">
        <h2>Программа</h2>
        <p className="cms-muted">{validDate(settings.event.arrivalDate) && validDate(settings.event.departureDate) ? `${dayCount(settings.event.arrivalDate, settings.event.departureDate)} с проживанием. ` : ""}Даты этапов берутся из раздела «Даты и город». Каждое событие пишите с новой строки — на сайте оно станет отдельным пунктом.</p>
        {settings.program.map((item, index) => <div className="cms-settings-item" key={index}>
          <h3>{["Заезд", "Начало конкурса", "Финал и награждение", "Выезд"][index]}</h3>
          <SettingField field={{label: "Название этапа", maxLength: 80}} name={`program.${index}.title`} value={item.title} onChange={title => updateItem("program", index, {title})} />
          <SettingField field={{label: "Описание этапа", type: "textarea", maxLength: 1000, rows: 8}} name={`program.${index}.text`} value={item.text} onChange={text => updateItem("program", index, {text})} />
          <SettingField field={{label: "Важное примечание (необязательно)", type: "textarea", maxLength: 500, optional: true}} name={`program.${index}.note`} value={item.note ?? ""} onChange={note => updateItem("program", index, {note})} />
        </div>)}
      </section>}
      {active === "jury" && <section className="cms-panel" id="settings-jury">
        <h2>Жюри</h2>
        <p className="cms-muted">Порядок карточек соответствует этому списку. Описание можно добавить позже. Вместо отсутствующей фотографии показывается силуэт секретного гостя.</p>
        {settings.jury.map((person, index) => <div className="cms-settings-item" key={index}>
          <div className="cms-settings-item__heading">
            <h3>Член жюри {index + 1}</h3>
            <div>
              <button type="button" className="cms-text-button" disabled={index === 0} onClick={() => moveJury(index, index - 1)}>Выше</button>
              <button type="button" className="cms-text-button" disabled={index === settings.jury.length - 1} onClick={() => moveJury(index, index + 1)}>Ниже</button>
              <button type="button" className="cms-text-button cms-danger" disabled={settings.jury.length === 1} onClick={() => onChange({...settings, jury: settings.jury.filter((_, i) => i !== index)})}>Убрать</button>
            </div>
          </div>
          <div className="cms-settings-fields">
            {[{key:"name",label:"Имя",maxLength:120},{key:"role",label:"Должность",maxLength:180},{key:"bio",label:"Описание (необязательно)",type:"textarea",maxLength:1000,optional:true}].map(field =>
              <SettingField key={field.key} field={field} name={`jury.${index}.${field.key}`} value={person[field.key]} onChange={value => updateItem("jury", index, {[field.key]: value})} />)}
            <SettingField field={{label:"Фотография",type:"image"}} name={`jury.${index}.image`} value={person.image || "/assets/hidden.png"} onUpload={onUpload} onChange={image => updateItem("jury", index, {image, spriteIndex:null})} />
          </div>
          {(person.image || person.spriteIndex !== null) && <button type="button" className="cms-text-button" onClick={() => updateItem("jury", index, {image:"",spriteIndex:null})}>Убрать фотографию</button>}
        </div>)}
        <button type="button" className="cms-button" disabled={settings.jury.length >= 12} onClick={() => onChange({...settings, jury:[...settings.jury,{name:"",role:"",bio:"",image:"",spriteIndex:null}]})}>Добавить члена жюри</button>
      </section>}
      {homeBlocks.filter(block=>active === `home-${block.key}`).map(block => <section className="cms-panel" key={block.key} id={`settings-home-${block.key}`}>
        <h2>{block.title}</h2>
        <p className="cms-muted">Тексты и фотографии этого блока. Изменения появятся после сохранения.{block.key === "format" && <> {"{awardDate}"} подставляет дату награждения, {"{minParticipants}"} — минимальное число участников.</>}</p>
        <div className="cms-settings-fields">{block.fields.map(field=><SettingField key={field.key} field={field} name={`home.${block.key}.${field.key}`} value={settings.home[block.key][field.key]} onChange={value=>updateHome(block.key,{[field.key]:value})} onUpload={onUpload} />)}</div>
        {block.lists.map(list => {
          const items = settings.home[block.key][list.key];
          const changeList = next => updateHome(block.key,{[list.key]:next});
          return <div className="cms-block-list" key={list.key}>
            <h3>{list.label} <small>({items.length})</small></h3>
            {items.map((item,index)=><details className="cms-block-item" key={index} open={items.length <= 4 ? true : undefined}>
              <summary><span>{String(index+1).padStart(2,"0")}</span>{item.title || item.label || "Новый пункт"}</summary>
              <div className="cms-block-item__body">
                <div className="cms-settings-fields">{list.fields.map(field=><SettingField key={field.key} field={field} name={`home.${block.key}.${list.key}.${index}.${field.key}`} value={item[field.key]} onChange={value=>changeList(items.map((old,i)=>i===index?{...old,[field.key]:value}:old))} onUpload={onUpload} />)}</div>
                <div className="cms-block-item__actions">
                  <button className="cms-text-button" type="button" disabled={!index} onClick={()=>{const next=[...items];[next[index-1],next[index]]=[next[index],next[index-1]];changeList(next);}}>Выше</button>
                  <button className="cms-text-button" type="button" disabled={index===items.length-1} onClick={()=>{const next=[...items];[next[index+1],next[index]]=[next[index],next[index+1]];changeList(next);}}>Ниже</button>
                  <button className="cms-text-button cms-danger" type="button" disabled={items.length<=list.min} onClick={()=>changeList(items.filter((_,i)=>i!==index))}>Убрать</button>
                </div>
              </div>
            </details>)}
            {list.min !== list.max && <button className="cms-button" type="button" disabled={items.length>=list.max} onClick={()=>changeList([...items,Object.fromEntries(list.fields.map(field=>[field.key,field.type==='number'?field.min:'']))])}>Добавить пункт</button>}
          </div>;
        })}
      </section>)}
      {pageDefinitions.filter(page=>active === page.key).map(({ key, label }) => {
        const page = settings.pages[key];
        return <section className="cms-panel" id={`settings-${key}`} key={key}>
          <h2>{label}</h2>
          <p className="cms-muted">Пустая строка разделяет абзацы. Почта и телефон из раздела «Контакты» подставляются вместо {"{email}"} и {"{phone}"}. {"{privacy}"} — ссылка на политику, {"{regulations}"} — на положение.</p>
          <p><a href={`/${key}`} target="_blank" rel="noreferrer">Открыть опубликованную страницу</a></p>
          <SettingField field={{ label: "Заголовок страницы", maxLength: 160 }} name={`pages.${key}.title`} value={page.title} onChange={title => updatePage(key, { title })} />
          <SettingField field={{ label: "Вступление", type: "textarea", maxLength: 2000 }} name={`pages.${key}.lead`} value={page.lead} onChange={lead => updatePage(key, { lead })} />
          {page.sections.map((section, index) => <div className="cms-settings-item" key={index}>
            <div className="cms-settings-item__heading">
              <h3>Раздел {index + 1}</h3>
              <div>
                <button type="button" className="cms-text-button" disabled={index === 0} onClick={() => moveSection(key, index, index - 1)}>Выше</button>
                <button type="button" className="cms-text-button" disabled={index === page.sections.length - 1} onClick={() => moveSection(key, index, index + 1)}>Ниже</button>
                <button type="button" className="cms-text-button cms-danger" disabled={page.sections.length === 1} onClick={() => updatePage(key, { sections: page.sections.filter((_, i) => i !== index) })}>Убрать</button>
              </div>
            </div>
            <SettingField field={{ label: "Название раздела", maxLength: 160 }} name={`pages.${key}.sections.${index}.heading`} value={section.heading} onChange={heading => updateSection(key, index, { heading })} />
            <SettingField field={{ label: "Текст раздела", type: "textarea", rows: 6, maxLength: 3000 }} name={`pages.${key}.sections.${index}.text`} value={section.text} onChange={text => updateSection(key, index, { text })} />
          </div>)}
          <button type="button" className="cms-button" disabled={page.sections.length >= 20} onClick={() => updatePage(key, { sections: [...page.sections, { heading: "", text: "" }] })}>Добавить раздел</button>
        </section>;
      })}
    </fieldset>
  </form>;
}
