import { add } from '../utils/math.js';


describe('add()', () => {
    it('adds two numbers correctly', () => {
        expect(add(1, 2)).toBe(3)
    })

    it('adds negative numbers', () => {
        expect(add(-1, 2)).toBe(1)
    })
})