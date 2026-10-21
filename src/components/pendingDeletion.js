// Owns the pending operation independently of renders and browser lifecycle events.
export function createPendingDeletion({ remove, removeOnLeave, onChange }) {
  let pending = null
  let sequence = 0
  const hiddenIds = new Set()

  async function commit(item = pending, leaving = false) {
    if (!item || pending !== item) return
    pending = null
    try {
      await (leaving ? removeOnLeave : remove)(item.id)
      hiddenIds.delete(item.id)
      item.success?.()
    } catch (error) {
      hiddenIds.delete(item.id)
      item.restore(error)
    }
  }

  return {
    hiddenIds,
    commit: () => commit(),
    leave: () => commit(pending, true),
    schedule(id, restore, success) {
      commit()
      const item = { id, restore, success }
      pending = item
      hiddenIds.add(id)
      onChange({
        key: ++sequence,
        onExpire: () => commit(item),
        onUndo: () => {
          if (pending !== item) return
          pending = null
          hiddenIds.delete(id)
          restore()
        }
      })
    }
  }
}
