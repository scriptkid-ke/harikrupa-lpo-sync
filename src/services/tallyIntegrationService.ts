/**
 * TallyIntegrationService
 * ------------------------
 * NOT IMPLEMENTED IN V1. Tally synchronization is explicitly out of scope
 * per the build spec (section 35) — Harikrupa currently uses TallyPrime
 * Gold 2.1 for accounting, and this app must not depend on it or fake a
 * working integration.
 *
 * This file exists only as the seam a future integration would plug into,
 * so that V1 doesn't need a rewrite when Tally sync is eventually built:
 *
 *   Harikrupa App → TallyIntegrationService → TallyPrime
 *
 * A real implementation would likely:
 *   - Listen for LPO_ISSUED / LPO_COLLECTED audit events (or poll `lpos`
 *     where status in ('issued','collected') and a new `tally_synced_at`
 *     column, added in a future migration, is null).
 *   - Translate an approved LPO into a Tally voucher via Tally's XML
 *     import interface (ODBC/HTTP XML gateway), likely from a scheduled
 *     Edge Function or a small sync worker, not from the browser.
 *   - Record success/failure similarly to how `notifications` tracks
 *     email/SMS delivery today.
 *
 * Every method below intentionally throws so nothing can silently no-op
 * and be mistaken for a working sync.
 */

export class TallyIntegrationService {
  async syncLpoToTally(_lpoId: string): Promise<never> {
    throw new Error(
      'TallyIntegrationService.syncLpoToTally is not implemented in v1. ' +
        'Tally integration is intentionally out of scope — see docs/ARCHITECTURE.md.'
    );
  }

  async getSyncStatus(_lpoId: string): Promise<never> {
    throw new Error('TallyIntegrationService.getSyncStatus is not implemented in v1.');
  }
}

export const tallyIntegrationService = new TallyIntegrationService();
