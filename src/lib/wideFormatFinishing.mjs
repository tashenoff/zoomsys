export function getBannerOperationKey(operation) {
  const id = String(operation?.id || '').toLowerCase()
  const name = String(operation?.name || '').toLowerCase()
  if (id === 'bannergluing' || name.includes('проклейка баннера')) return 'bannerGluing'
  if (id === 'bannerjoining' || name.includes('склейка баннера')) return 'bannerJoining'
  return null
}

export function getBannerOperation(operations, material, key) {
  const bannerLike = material?.glueAllowed != null
    ? !!material.glueAllowed
    : ['баннер', 'фронтлит', 'бэклит', 'сетка'].some(word => String(material?.name || '').toLowerCase().includes(word))
  if (!bannerLike) return null

  return Object.entries(operations || {}).map(([id, operation]) => ({ ...operation, id: operation?.id ?? id }))
    .find(operation => {
      if (getBannerOperationKey(operation) !== key || operation.is_active === false || operation.isActive === false) return false
      const applicableTo = operation.applicableTo ?? operation.applicable_to
      if (Array.isArray(applicableTo) && !applicableTo.includes('wide-format') && !applicableTo.includes('all')) return false
      const allowed = material?.operations
      return !Array.isArray(allowed) || allowed.map(String).some(id => id === key || id === String(operation.id))
    }) || null
}

// Keep the calculator's existing tariff resolver and allowance formulas.
// Layout and finishing are independent of whether waste is billed.
export function calculateWideFormatFinishing({
  material, operations, width, height, quantity, selectedOperationIds = [], includeWaste = true
}, getTierPrice) {
  const margin = material.wasteMargin != null ? Number(material.wasteMargin) : 0.2
  const roll = Number(material.rollWidth) || 0
  const wastePrice = Number(material.wastePrice) || 0
  const longSide = Math.max(width, height) + margin
  const splitSide = Math.min(width, height) + margin
  const printAreaItem = (width + margin) * (height + margin)
  let wasteInfo = null

  if (roll > 0) {
    const candidates = [splitSide, longSide].filter(side => side <= roll)
    const printAcross = candidates.length ? Math.max(...candidates) : splitSide
    const joined = printAcross > roll
    const pieces = joined ? Math.max(2, Math.ceil(splitSide / roll)) : 1
    const printAlong = joined ? longSide : printAreaItem / printAcross
    const remainSqm = joined
      ? Math.max(0, pieces * roll * longSide * quantity - printAreaItem * quantity)
      : Math.max(0, (roll - printAcross) * printAlong * quantity)
    const above = remainSqm >= 0.5 && wastePrice > 0
    wasteInfo = {
      joined, roll, printAcross, printAlong, longSide, splitSide, joinedAcross: splitSide,
      itemAcross: Math.min(width, height), margin, pieces, seams: pieces - 1,
      remainSqm, wastePrice, above, belowThreshold: !above,
      includeWaste, wasteTotal: includeWaste && above ? Math.round(remainSqm * wastePrice) : 0
    }
  }

  const joiningOperation = getBannerOperation(operations, material, 'bannerJoining')
  const gluingOperation = getBannerOperation(operations, material, 'bannerGluing')
  const bannerJoiningApplied = !!joiningOperation && !!wasteInfo?.joined
  const bannerGluingSelected = !!gluingOperation && selectedOperationIds.map(String).includes(String(gluingOperation.id))
  const glueMetersPerItem = wasteInfo?.joined ? wasteInfo.seams * longSide : 0
  const glueingMetersPerItem = bannerGluingSelected ? 2 * (longSide + splitSide) : 0

  function charge(operation, key, metersPerItem, automatic) {
    if (!operation || metersPerItem <= 0) return null
    const meters = metersPerItem * quantity
    const tariff = getTierPrice(operation.prices, meters, operation.price)
    const unitPrice = Number(tariff.price) || 0
    const label = key === 'bannerGluing' ? 'Проклейка баннера по периметру' : operation.name
    const unit = operation.unit || 'пог.м'
    return {
      operationKey: key, id: String(operation.id), automatic,
      name: `${label} (${meters} ${unit}${tariff.tier ? `, ${tariff.tier}` : ''})`,
      price: unitPrice * meters, quantity: meters, metersPerItem, unit, unitPrice, tier: tariff.tier
    }
  }

  const joining = bannerJoiningApplied ? charge(joiningOperation, 'bannerJoining', glueMetersPerItem, true) : null
  const gluing = bannerGluingSelected ? charge(gluingOperation, 'bannerGluing', glueingMetersPerItem, false) : null
  const extras = [joining, gluing].filter(Boolean)

  if (wasteInfo) {
    // Preserve existing layout details in saved specifications.
    Object.assign(wasteInfo, {
      bannerLike: !!joiningOperation || !!gluingOperation,
      glueMetersPerItem, glueMeters: glueMetersPerItem * quantity,
      glueUnitPrice: joining?.unitPrice || 0, glueTier: joining?.tier || null, gluePrice: joining?.price || 0,
      glueingMetersPerItem, glueingMeters: glueingMetersPerItem * quantity,
      glueingUnitPrice: gluing?.unitPrice || 0, glueingTier: gluing?.tier || null, glueingPrice: gluing?.price || 0
    })
  }

  return {
    wasteInfo, wasteTotal: wasteInfo?.wasteTotal || 0,
    extras, extrasTotal: extras.reduce((total, operation) => total + operation.price, 0),
    bannerJoiningApplied, bannerGluingSelected
  }
}
