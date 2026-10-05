import { describe, expect, it } from 'vitest'
import { validateItemPatch, validateNewItem } from '../../server/utils/validate-item'

const valid = { name: 'Desk Lamp', category: 'Electronics', price: 24.5, image: '💡' }

interface ValidationFailure {
  statusCode: number
  errors: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function failureOf(run: () => unknown): ValidationFailure {
  try {
    run()
  } catch (error: unknown) {
    if (!isRecord(error)) throw new Error('validation threw a non-object')
    const data = error.data
    const errors = isRecord(data) && Array.isArray(data.errors) ? data.errors : []
    return {
      statusCode: typeof error.statusCode === 'number' ? error.statusCode : -1,
      errors: errors.filter((e): e is string => typeof e === 'string'),
    }
  }
  throw new Error('expected validation to fail, but it passed')
}

describe('validateNewItem', () => {
  it('accepts a valid body', () => {
    expect(validateNewItem(valid)).toEqual(valid)
  })

  it('trims name and image', () => {
    expect(validateNewItem({ ...valid, name: '  Lamp  ', image: ' 💡 ' })).toMatchObject({
      name: 'Lamp',
      image: '💡',
    })
  })

  it('rounds price to 2 decimals', () => {
    expect(validateNewItem({ ...valid, price: 10.4567 }).price).toBe(10.46)
  })

  it('accepts a price of 0', () => {
    expect(validateNewItem({ ...valid, price: 0 }).price).toBe(0)
  })

  it('accepts names of exactly 80 characters', () => {
    expect(validateNewItem({ ...valid, name: 'a'.repeat(80) }).name).toHaveLength(80)
  })

  it('rejects an empty name', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, name: '   ' }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects a name longer than 80 characters', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, name: 'a'.repeat(81) }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects a non-string name', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, name: 42 }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects a category outside CATEGORIES', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, category: 'Toys' }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects a negative price', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, price: -1 }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['a numeric string', '10'],
  ])('rejects a non-finite or non-number price (%s)', (_label, price) => {
    const failure = failureOf(() => validateNewItem({ ...valid, price }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects an empty image', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, image: '' }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects an image longer than 200 characters', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, image: 'x'.repeat(201) }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('rejects a body with a missing field', () => {
    const { image: _image, ...withoutImage } = valid
    const failure = failureOf(() => validateNewItem(withoutImage))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(1)
  })

  it('collects every error into one 400 error', () => {
    const failure = failureOf(() =>
      validateNewItem({ name: '', category: 'Toys', price: -5, image: '' }),
    )
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(4)
  })

  it('rejects unknown keys', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, colour: 'red' }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors.some((e) => e.includes('colour'))).toBe(true)
  })

  it('rejects an id in the body', () => {
    const failure = failureOf(() => validateNewItem({ ...valid, id: 50 }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors.some((e) => e.includes('id'))).toBe(true)
  })

  it.each([
    ['null', null],
    ['an array', [valid]],
    ['a string', 'item'],
  ])('rejects a body that is not an object (%s)', (_label, body) => {
    expect(failureOf(() => validateNewItem(body)).statusCode).toBe(400)
  })
})

describe('validateItemPatch', () => {
  it('accepts a single field', () => {
    expect(validateItemPatch({ price: 9.5 })).toEqual({ price: 9.5 })
  })

  it('rounds price to 2 decimals', () => {
    expect(validateItemPatch({ price: 3.14159 })).toEqual({ price: 3.14 })
  })

  it('rejects an empty patch', () => {
    const failure = failureOf(() => validateItemPatch({}))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors.length).toBeGreaterThan(0)
  })

  it('rejects an id in the patch', () => {
    const failure = failureOf(() => validateItemPatch({ id: 3, name: 'New' }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors.some((e) => e.includes('id'))).toBe(true)
  })

  it('rejects unknown keys', () => {
    expect(failureOf(() => validateItemPatch({ stock: 3 })).statusCode).toBe(400)
  })

  it('applies the same field rules as a new item', () => {
    const failure = failureOf(() => validateItemPatch({ category: 'Food', price: -1 }))
    expect(failure.statusCode).toBe(400)
    expect(failure.errors).toHaveLength(2)
  })
})
