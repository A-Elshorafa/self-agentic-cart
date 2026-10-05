import type { Item } from '@shared/contract'

export const SEED_ITEMS: readonly Item[] = Object.freeze([
  { id: 1, name: 'Wireless Headphones', category: 'Electronics', price: 59.99, image: '🎧' },
  { id: 2, name: 'Smart Watch', category: 'Electronics', price: 129.99, image: '⌚' },
  { id: 3, name: 'Bluetooth Speaker', category: 'Electronics', price: 39.99, image: '🔊' },
  { id: 4, name: 'USB-C Charger', category: 'Electronics', price: 19.99, image: '🔌' },
  { id: 5, name: 'Cotton T-Shirt', category: 'Clothing', price: 14.99, image: '👕' },
  { id: 6, name: 'Denim Jeans', category: 'Clothing', price: 49.99, image: '👖' },
  { id: 7, name: 'Running Shoes', category: 'Clothing', price: 89.99, image: '👟' },
  { id: 8, name: 'Clean Code', category: 'Books', price: 34.99, image: '📘' },
  { id: 9, name: 'The Pragmatic Programmer', category: 'Books', price: 39.99, image: '📗' },
  { id: 10, name: 'Designing Data-Intensive Applications', category: 'Books', price: 44.99, image: '📙' },
] satisfies Item[])
