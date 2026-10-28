import { CatalogSelects, Notice, Pagination, SearchInput, useAdminResource, useCatalog, useUrlFilters } from './ui'

// Resalta el término buscado dentro del texto.
function Highlight({ text, term }) {
  if (!term) return text
  const index = text.toLowerCase().indexOf(term.toLowerCase())
  if (index === -1) return text
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + term.length)}</mark>{text.slice(index + term.length)}</>
}

export default function AdminQuestionSearch({ search = '' }) {
  const [filters, setFilters] = useUrlFilters({ q: '', grade: '', subject: '', topic: '', page: 1 }, search)
  const { catalog } = useCatalog()
  const active = Boolean(filters.q || filters.grade)
  const { data, loading, error } = useAdminResource(active ? '/questions' : null, filters)
  const items = active ? data?.items || [] : []

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>Preguntas</h1>
          <p>Busca en el enunciado, las opciones y la explicación de todas las preguntas publicadas.</p>
        </div>
      </header>

      <form className="admin-filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchInput id="question-search" label="Texto" value={filters.q} placeholder="p. ej. RAID 5" onChange={(q) => setFilters({ q })} />
        <CatalogSelects idPrefix="question-filter" catalog={catalog}
          value={{ grade: filters.grade, subject: filters.subject, topic: filters.topic }} onChange={(value) => setFilters(value)} />
      </form>

      <Notice tone="danger">{error}</Notice>

      {!active ? <p className="admin-muted">Escribe un texto o elige un curso para empezar.</p> : (
        <div className="admin-table-wrap" aria-busy={loading}>
          <table className="admin-table">
            <caption className="sr-only">Preguntas encontradas</caption>
            <thead>
              <tr>
                <th scope="col">Pregunta</th>
                <th scope="col">Cuestionario</th>
                <th scope="col" className="actions"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.quiz_id}-${item.question_index}`}>
                  <td data-label="Pregunta">
                    <strong>{item.question_index + 1}. <Highlight text={item.question || ''} term={filters.q} /></strong>
                    <div className="admin-muted">
                      Correcta: <Highlight text={String(item.options?.[item.answer] ?? '—')} term={filters.q} />
                    </div>
                  </td>
                  <td data-label="Cuestionario">
                    {item.quiz_title || `n.º ${item.quiz_id}`}
                    <div className="admin-code">/{item.grado}/{item.course_id}/{item.topic}</div>
                  </td>
                  <td className="actions">
                    <a className="btn-secondary btn-small" href={`/admin/cuestionarios/${item.quiz_id}?pregunta=${item.question_index}`}>Abrir en el editor</a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && items.length === 0 && <p className="admin-empty">No hay preguntas que coincidan.</p>}
          {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setFilters({ page })} />}
        </div>
      )}
    </div>
  )
}
