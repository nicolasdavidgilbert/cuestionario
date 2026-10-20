export default function QuizCard({ href, badge, title, subtitle = 'Cuestionario tipo test', actionLabel = 'Empezar', children }) {
  const body = (
    <>
      <article>
        <span className="unit-badge">{badge}</span>
        <strong>{title}</strong>
        <span className="unit-title">{subtitle}</span>
      </article>
      <span className="unit-action">{actionLabel}</span>
    </>
  )

  if (!children) {
    return <a href={href} className="unit-card">{body}</a>
  }

  return (
    <div className="unit-card unit-card--with-actions">
      <a href={href} className="unit-card-link">{body}</a>
      <div className="unit-card-extra">{children}</div>
    </div>
  )
}
