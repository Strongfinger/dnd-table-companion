import { describe, expect, it } from 'vitest'
import { fitSize } from './imageResize'

describe('fitSize', () => {
  it('shrinks the long side to the limit, never enlarges', () => {
    expect(fitSize(4000, 3000)).toEqual({ width: 1600, height: 1200 })
    expect(fitSize(3000, 4000, 800)).toEqual({ width: 600, height: 800 })
    expect(fitSize(640, 480)).toEqual({ width: 640, height: 480 })
    expect(fitSize(0, 0)).toEqual({ width: 1, height: 1 })
  })
})
