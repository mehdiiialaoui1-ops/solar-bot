/**
 * Tests unitaires - Client Lemlist API
 * ERE SOLAR BOT - Vitest
 */

import { describe, it, expect, vi } from 'vitest'
import {
  buildAuthHeader,
  buildAddLeadUrl,
  addLead,
  LEMLIST_BASE,
} from '../../src/outreach/lemlist'
import { OutreachError } from '../../src/outreach/types'

const FAKE_KEY = 'lem_api_key_test_1234567890ABCDEFG'

// =============================================
// buildAuthHeader
// =============================================

describe('buildAuthHeader', () => {
  it("encode en Basic ':apikey' base64", () => {
    const header = buildAuthHeader(FAKE_KEY)
    expect(header).toMatch(/^Basic [A-Za-z0-9+/=]+$/)
    // Decode pour verifier
    const encoded = header.replace('Basic ', '')
    const decoded =
      typeof atob !== 'undefined'
        ? atob(encoded)
        : Buffer.from(encoded, 'base64').toString('utf8')
    expect(decoded).toBe(`:${FAKE_KEY}`)
  })

  it("rejette une clé absente ou trop courte", () => {
    expect(() => buildAuthHeader('')).toThrow(OutreachError)
    expect(() => buildAuthHeader('abc')).toThrow(OutreachError)
  })
})

// =============================================
// buildAddLeadUrl
// =============================================

describe('buildAddLeadUrl', () => {
  it("construit une URL valide avec encoding", () => {
    const url = buildAddLeadUrl('cmp_test_001', 'marie@acme.fr')
    expect(url).toContain(LEMLIST_BASE)
    expect(url).toContain('cmp_test_001')
    expect(url).toContain('marie%40acme.fr')
  })

  it("rejette campaignId trop court", () => {
    expect(() => buildAddLeadUrl('x', 'a@b.fr')).toThrow(OutreachError)
  })

  it("rejette email sans @", () => {
    expect(() => buildAddLeadUrl('cmp_001_long', 'pasunemail')).toThrow(OutreachError)
  })
})

// =============================================
// addLead
// =============================================

describe('addLead', () => {
  it("renvoie status='added' sur 200 OK", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ _id: 'lead_123', email: 'marie@acme.fr' }),
    } as Response)
    const out = await addLead({
      campaignId: 'cmp_test_001',
      lead: { email: 'marie@acme.fr', firstName: 'Marie' },
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(out.status).toBe('added')
    expect(out._id).toBe('lead_123')
  })

  it("renvoie status='duplicate' sur 409", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      statusText: 'Conflict',
    } as Response)
    const out = await addLead({
      campaignId: 'cmp_test_001',
      lead: { email: 'marie@acme.fr' },
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(out.status).toBe('duplicate')
  })

  it("renvoie status='paused' sur 423", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 423,
      statusText: 'Locked',
    } as Response)
    const out = await addLead({
      campaignId: 'cmp_test_001',
      lead: { email: 'marie@acme.fr' },
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(out.status).toBe('paused')
  })

  it("lève HTTP_ERROR sur 500", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Server Error',
    } as Response)
    await expect(
      addLead({
        campaignId: 'cmp_test_001',
        lead: { email: 'marie@acme.fr' },
        apiKey: FAKE_KEY,
        fetchImpl: fakeFetch as unknown as typeof fetch,
      }),
    ).rejects.toBeInstanceOf(OutreachError)
  })

  it("envoie le bon header Authorization Basic", async () => {
    const fakeFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({ _id: 'lead_x', email: 'a@b.fr' }),
    } as Response)
    await addLead({
      campaignId: 'cmp_test_001',
      lead: { email: 'a@b.fr' },
      apiKey: FAKE_KEY,
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(fakeFetch).toHaveBeenCalledOnce()
    const headers = (fakeFetch.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers.Authorization).toMatch(/^Basic /)
  })
})
