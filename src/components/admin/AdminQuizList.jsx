import { useState } from 'react'
import UndoToast from '../UndoToast'
import { adminApi } from '../../lib/adminApi'
import { CatalogSelects, formatDate, Notice, Pagination, quizRoute, SearchInput, useAdminResource, useCatalog, useUrlFilters } from './ui'

// Listado de cuestionarios publicados (mode="active") o de la papelera (mode="trash").
export default function AdminQuizList({ mode = 'active', search = '' }) {
  const trash = mode === 'trash'
  const [filters, setFilters] = useUrlFilters({ q: '', grade: '', subject: '', topic: '', page: 1 }, search)
  const { catalog } = useCatalog()
  const { data, loading, error, reload } = useAdminResource('/quizzes', { ...filters, status: trash ? 'papelera' : '' })
  const [notice, setNotice] = useState(null)
  const [undo, setUndo] = useState(null)
  const [busyId, setBusyId] = useState(0)

  const sendToTrash = async (quiz) => {
    if (!window.confirm(`¿Enviar «${quiz.title || `n.º ${quiz.id}`}» a la papelera? Dejará de verse en ${quizRoute(quiz)}. Podrás restaurarlo.`)) return
    setBusyId(quiz.id)
    setNotice(null)
    try {
      await adminApi.del(`/quizzes/${quiz.id}`)
      setUndo({ key: Date.now(), quiz })
      reload()
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message })
    } finally {
      setBusyId(0)
    }
  }

  const restore = async (quiz) => {
    setBusyId(quiz.id)
    setNotice(null)
    try {
      await adminApi.post(`/quizzes/${quiz.id}/restore`)
      setNotice({ tone: 'success', text: `«${quiz.title || `n.º ${quiz.id}`}» se ha restaurado y vuelve a estar publicado en ${quizRoute(quiz)}.` })
      reload()
    } catch (err) {
      setNotice({ tone: 'danger', text: `No se pudo restaurar: ${err.message}`, quiz: err.data?.id })
    } finally {
      setBusyId(0)
    }
  }

  const items = data?.items || []

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div>
          <h1>{trash ? 'Papelera' : 'Cuestionarios'}</h1>
          <p>{trash
            ? 'Cuestionarios retirados de la web. Al restaurarlos se comprueba que su ruta y su contenido sigan libres.'
            : 'Todos los cuestionarios publicados, sea quien sea su autor.'}</p>
        </div>
        {!trash && <a className="btn-primary" href="/admin/cuestionarios/nuevo">Nuevo cuestionario</a>}
      </header>

      <form className="admin-filters" role="search" onSubmit={(event) => event.preventDefault()}>
        <SearchInput id="quiz-search" label="Buscar" value={filters.q} placeholder="Título, descripción, ID o tema"
          onChange={(q) => setFilters({ q })} />
        <CatalogSelects idPrefix="quiz-filter" catalog={catalog}
          value={{ grade: filters.grade, subject: filters.subject, topic: filters.topic }}
          onChange={(value) => setFilters(value)} />
        {(filters.q || filters.grade) && (
          <button type="button" className="btn-clear btn-small" onClick={() => setFilters({ q: '', grade: '', subject: '', topic: '' })}>Limpiar</button>
        )}
      </form>

      {notice && (
        <Notice tone={notice.tone}>
          <p>{notice.text}</p>
          {notice.quiz && <p><a href={`/admin/cuestionarios/${notice.quiz}`}>Ver el cuestionario que ocupa esa ruta</a></p>}
        </Notice>
      )}
      <Notice tone="danger">{error}</Notice>

      <div className="admin-table-wrap" aria-busy={loading}>
        <table className="admin-table">
          <caption className="sr-only">{trash ? 'Cuestionarios en la papelera' : 'Cuestionarios publicados'}</caption>
          <thead>
            <tr>
              <th scope="col">Cuestionario</th>
              <th scope="col">Ruta</th>
              <th scope="col" className="num">Preguntas</th>
              <th scope="col">{trash ? 'En la papelera desde' : 'Actualizado'}</th>
              <th scope="col" className="actions"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {items.map((quiz) => (
              <tr key={quiz.id}>
                <td data-label="Cuestionario">
                  <a href={`/admin/cuestionarios/${quiz.id}`}>{quiz.title || 'Sin título'}</a>
                  <div className="admin-muted">
                    n.º {quiz.id} · {quiz.topic_name || quiz.topic} · v{quiz.version}
                    {quiz.open_issues > 0 && <> · <a href={`/admin/incidencias?quiz=${quiz.id}&status=abiertas`} className="admin-badge admin-badge--accent">{quiz.open_issues} incidencia{quiz.open_issues === 1 ? '' : 's'}</a></>}
                  </div>
                </td>
                <td data-label="Ruta"><span className="admin-code">{quizRoute(quiz)}</span></td>
                <td data-label="Preguntas" className="num">{quiz.question_count}</td>
                <td data-label={trash ? 'En la papelera desde' : 'Actualizado'}>{formatDate(trash ? quiz.deleted_at : quiz.updated_at || quiz.created_at)}</td>
                <td className="actions">
                  <div className="admin-actions">
                    {trash ? (
                      <>
                        <a className="btn-secondary btn-small" href={`/admin/cuestionarios/${quiz.id}`}>Ver</a>
                        <button type="button" className="btn-primary btn-small" disabled={busyId === quiz.id} onClick={() => restore(quiz)}>Restaurar</button>
                      </>
                    ) : (
                      <>
                        <a className="btn-secondary btn-small" href={quizRoute(quiz)} target="_blank" rel="noopener">Ver<span className="sr-only"> en la web (pestaña nueva)</span></a>
                        <a className="btn-secondary btn-small" href={`/admin/cuestionarios/${quiz.id}`}>Editar</a>
                        <button type="button" className="btn-clear btn-danger btn-small" disabled={busyId === quiz.id} onClick={() => sendToTrash(quiz)}>Papelera</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && items.length === 0 && (
          <p className="admin-empty">{trash ? 'La papelera está vacía.' : 'No hay cuestionarios con estos filtros.'}</p>
        )}
        {loading && items.length === 0 && <p className="admin-empty">Cargando…</p>}
        {data && <Pagination page={data.page} pageSize={data.pageSize} total={data.total} onPage={(page) => setFilters({ page })} />}
      </div>

      {undo && (
        <UndoToast
          key={undo.key}
          message={`«${undo.quiz.title || `n.º ${undo.quiz.id}`}» enviado a la papelera`}
          onUndo={async () => {
            try {
              await adminApi.post(`/quizzes/${undo.quiz.id}/restore`)
              reload()
            } catch (err) {
              setNotice({ tone: 'danger', text: `No se pudo deshacer: ${err.message}` })
            }
          }}
        />
      )}
    </div>
  )
}
