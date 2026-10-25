// Geometry only. Prices, roll width and print allowance remain in the existing price list.
export function calculateStickerLayout({ width, height, quantity, rollWidth, margin, gap }) {
  if (![width, height, rollWidth].every(value => Number.isFinite(value) && value > 0)
    || !Number.isInteger(quantity) || quantity <= 0 || !Number.isFinite(margin) || margin < 0
    || !Number.isFinite(gap) || gap < 0) throw Error('Укажите положительные размеры, целое количество и неотрицательный зазор')
  const usable = rollWidth - margin
  const candidates = [[width, height, false], [height, width, true]].map(([across, along, rotated]) => {
    const columns = Math.min(quantity, Math.floor((usable + gap + 1e-9) / (across + gap)))
    if (columns < 1) return null
    const rows = Math.ceil(quantity / columns)
    const sheetWidth = columns * across + (columns - 1) * gap
    const sheetHeight = rows * along + (rows - 1) * gap
    return { columns, rows, rotated, across, along, sheetWidth, sheetHeight,
      printWidth: sheetWidth + margin, printHeight: sheetHeight + margin }
  }).filter(Boolean).sort((a, b) => a.printHeight - b.printHeight || a.printWidth - b.printWidth)
  if (!candidates.length) throw Error('Наклейка с припуском не помещается по ширине рулона')
  const chosen = candidates[0]
  return { ...chosen, rollWidth, margin, gap, quantity, netArea: width * height * quantity,
    blankCells: chosen.columns * chosen.rows - quantity, printArea: chosen.printWidth * chosen.printHeight }
}
