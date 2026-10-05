import { createError, getRouterParam } from 'h3'
import type { H3Event } from 'h3'
import { CATEGORIES } from '@shared/contract'
import type { Category, NewItem } from '@shared/contract'

const ALLOWED_KEYS = ['name', 'category', 'price', 'image'] as const
type ItemKey = (typeof ALLOWED_KEYS)[number]

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAllowedKey(key: string): key is ItemKey {
  return (ALLOWED_KEYS as readonly string[]).includes(key)
}

function isCategory(value: unknown): value is Category {
  return typeof value === 'string' && (CATEGORIES as readonly string[]).includes(value)
}

function invalid(errors: string[]): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'Invalid item',
    data: { errors },
  })
}

function validateString(field: string, value: unknown, max: number, errors: string[]): string | undefined {
  if (typeof value !== 'string') {
    errors.push(`${field} must be a string`)
    return undefined
  }
  const trimmed = value.trim()
  if (trimmed.length < 1 || trimmed.length > max) {
    errors.push(`${field} must be 1-${max} characters`)
    return undefined
  }
  return trimmed
}

function validateFields(body: unknown, requireAll: boolean): Partial<NewItem> {
  if (!isPlainObject(body)) {
    invalid(['body must be a JSON object'])
  }

  const errors: string[] = []
  const result: Partial<NewItem> = {}

  for (const key of Object.keys(body)) {
    if (!isAllowedKey(key)) errors.push(`unknown field: ${key}`)
  }

  for (const key of ALLOWED_KEYS) {
    const value = body[key]
    if (value === undefined) {
      if (requireAll) errors.push(`${key} is required`)
      continue
    }
    switch (key) {
      case 'name': {
        const name = validateString('name', value, 80, errors)
        if (name !== undefined) result.name = name
        break
      }
      case 'image': {
        const image = validateString('image', value, 200, errors)
        if (image !== undefined) result.image = image
        break
      }
      case 'category': {
        if (isCategory(value)) {
          result.category = value
        } else {
          errors.push(`category must be one of: ${CATEGORIES.join(', ')}`)
        }
        break
      }
      case 'price': {
        if (typeof value !== 'number' || !Number.isFinite(value)) {
          errors.push('price must be a finite number')
        } else if (value < 0) {
          errors.push('price must be >= 0')
        } else {
          result.price = Math.round(value * 100) / 100
        }
        break
      }
    }
  }

  if (!requireAll && Object.keys(body).length === 0) {
    errors.push(`at least one field is required: ${ALLOWED_KEYS.join(', ')}`)
  }

  if (errors.length > 0) invalid(errors)
  return result
}

export function validateNewItem(body: unknown): NewItem {
  const result = validateFields(body, true)
  const { name, category, price, image } = result
  // validateFields throws unless every field is present when requireAll is true.
  if (name === undefined || category === undefined || price === undefined || image === undefined) {
    invalid(['name, category, price and image are required'])
  }
  return { name, category, price, image }
}

export function validateItemPatch(body: unknown): Partial<NewItem> {
  return validateFields(body, false)
}

export function parseId(event: H3Event): number {
  const raw = getRouterParam(event, 'id') ?? ''
  const id = /^\d+$/.test(raw) ? Number(raw) : Number.NaN
  if (!Number.isSafeInteger(id) || id < 1) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid id',
      data: { errors: ['id must be a positive integer'] },
    })
  }
  return id
}
