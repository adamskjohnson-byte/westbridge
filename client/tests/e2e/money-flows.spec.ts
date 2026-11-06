import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

const apiRoot = process.env.E2E_API_URL ?? 'http://127.0.0.1:8000/api'
const apiOrigin = apiRoot.replace(/\/api\/?$/, '')
const spaOrigin = process.env.E2E_FRONTEND_URL ?? 'http://127.0.0.1:5173'
const database = process.env.DB_DATABASE ?? ''
const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../server')
const contexts: BrowserContext[] = []

test.beforeAll(() => {
  if (!database.endsWith('_e2e')) throw new Error('E2E tests refuse to run unless DB_DATABASE ends with _e2e.')
  if (process.env.APP_ENV !== 'local' || process.env.DB_CONNECTION !== 'mysql') {
    throw new Error('E2E tests require APP_ENV=local and DB_CONNECTION=mysql.')
  }
})

test.afterEach(async () => {
  await Promise.all(contexts.splice(0).map((context) => context.close()))
})

type Account = { id: number; type: 'checking' | 'savings'; balance_cents: number; account_number: string }
type UserSession = { context: BrowserContext; email: string; firstName: string; lastName: string; checking: Account; savings: Account }
type Inspection = {
  user: { id: number; email: string }
  accounts: { id: number; type: string; balance_cents: number; account_number: string }[]
  transactions: { id: number; account_id: number; card_id: number | null; transfer_id: string | null; direction: string; category: string; amount_cents: number; balance_after_cents: number; reference: string; posted_at: string }[]
  cards: { id: number; account_id: number; last4: string; status: string; daily_limit_cents: number }[]
  notifications: { id: string; data: string; read_at: string | null; created_at: string }[]
  transfers: { id: string; from_account_id: number; to_account_id: number; amount_cents: number; status: string; idempotency_key: string }[]
  bill_payments: { id: string; account_id: number; amount_cents: number; status: string; transaction_id: number; idempotency_key: string }[]
}

function standardHeaders(): Record<string, string> {
  return { Accept: 'application/json', Origin: spaOrigin, 'X-Requested-With': 'XMLHttpRequest' }
}

async function getApi<T>(context: BrowserContext, pathName: string): Promise<T> {
  const response = await context.request.get(`${apiRoot}${pathName}`, { headers: standardHeaders() })
  expect(response.ok(), `${pathName} returned ${response.status()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function postApi<T>(context: BrowserContext, pathName: string, data: unknown): Promise<T> {
  const csrfResponse = await context.request.get(`${apiOrigin}/sanctum/csrf-cookie`, { headers: standardHeaders() })
  expect(csrfResponse.ok(), 'CSRF cookie endpoint should be available').toBeTruthy()
  const csrfCookie = (await context.cookies(apiOrigin)).find((cookie) => cookie.name === 'XSRF-TOKEN')
  expect(csrfCookie, 'Sanctum should set an XSRF-TOKEN cookie').toBeTruthy()

  const response = await context.request.post(`${apiRoot}${pathName}`, {
    headers: {
      ...standardHeaders(),
      'Content-Type': 'application/json',
      'X-XSRF-TOKEN': decodeURIComponent(csrfCookie!.value),
    },
    data,
  })
  expect(response.ok(), `${pathName} returned ${response.status()}: ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function patchApi<T>(context: BrowserContext, pathName: string, data: unknown): Promise<T> {
  const csrfResponse = await context.request.get(`${apiOrigin}/sanctum/csrf-cookie`, { headers: standardHeaders() })
  expect(csrfResponse.ok(), 'CSRF cookie endpoint should be available').toBeTruthy()
  const csrfCookie = (await context.cookies(apiOrigin)).find((cookie) => cookie.name === 'XSRF-TOKEN')
  expect(csrfCookie, 'Sanctum should set an XSRF-TOKEN cookie').toBeTruthy()
  const response = await context.request.patch(`${apiRoot}${pathName}`, {
    headers: { ...standardHeaders(), 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(csrfCookie!.value) },
    data,
  })
  expect(response.ok(), `${pathName} returned ${response.status()}: ${await response.text()}`).toBeTruthy()
  return response.json() as Promise<T>
}

async function loginCustomer(browser: Browser, email: string): Promise<UserSession> {
  const context = await browser.newContext()
  contexts.push(context)
  await postApi(context, '/v1/auth/login', { email, password: 'E2eSecurePass123' })
  const accounts = inspect(email).accounts
  return {
    context,
    email,
    firstName: '',
    lastName: '',
    checking: accounts.find((account) => account.type === 'checking')!,
    savings: accounts.find((account) => account.type === 'savings')!,
  }
}

function runE2eCommand(command: string, args: string[] = []): string {
  if (!database.endsWith('_e2e')) throw new Error('Refusing to invoke E2E command against a non-_e2e database.')
  return execFileSync('php', ['artisan', command, ...args], {
    cwd: serverRoot,
    env: process.env,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

async function createCustomer(browser: Browser, firstName: string, lastName: string, fundingCents = 1000): Promise<UserSession> {
  const context = await browser.newContext()
  contexts.push(context)
  const email = `e2e-${randomUUID()}@example.test`
  const registration = await postApi<{ data: { id: number; email: string; email_verified: boolean } }>(context, '/v1/auth/register', {
    first_name: firstName,
    last_name: lastName,
    email,
    password: 'E2eSecurePass123',
    password_confirmation: 'E2eSecurePass123',
    accept_terms: true,
  })
  expect(registration.data.email_verified).toBe(true)
  runE2eCommand('dev:e2e-fund', [email, String(fundingCents)])

  const accountDetails = inspect(email).accounts
  const checking = accountDetails.find((account) => account.type === 'checking')
  const savings = accountDetails.find((account) => account.type === 'savings')
  expect(checking).toBeTruthy()
  expect(savings).toBeTruthy()

  return { context, email, firstName, lastName, checking: checking!, savings: savings! }
}

function inspect(email: string): Inspection {
  const output = runE2eCommand('dev:e2e-inspect', [email]).trim()
  return JSON.parse(output) as Inspection
}

async function openTransfers(page: Page): Promise<void> {
  await page.goto('/dashboard/transfers')
  await expect(page.getByRole('heading', { name: 'Transfers', level: 2 })).toBeVisible()
  await expect(page.getByLabel('From account')).toBeVisible()
}

async function openOwnTransferReview(page: Page, amount: string): Promise<void> {
  await openTransfers(page)
  await page.getByLabel('Amount in dollars').fill(amount)
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Review', level: 3 })).toBeVisible()
}

async function lookUpNewRecipient(page: Page, number: string, maskedName?: string): Promise<void> {
  await page.getByRole('button', { name: 'New recipient' }).click()
  await page.getByLabel('10-digit account number').fill(number)
  await page.getByRole('button', { name: 'Check' }).click()
  if (maskedName) await expect(page.getByText(`Verified account holder: ${maskedName}`)).toBeVisible()
  else await expect(page.getByText(/^Verified account holder:/)).toBeVisible()
  const confirmation = page.getByRole('checkbox')
  await confirmation.check()
}

async function sendExternalTransfer(page: Page, accountNumber: string, amount: string, maskedName?: string): Promise<void> {
  await openTransfers(page)
  await lookUpNewRecipient(page, accountNumber, maskedName)
  await page.getByLabel('Amount in dollars').fill(amount)
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Review', level: 3 })).toBeVisible()
}

async function confirmTransfer(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Transfer complete' })).toBeVisible()
}

async function visitAccountTransactions(page: Page, accountId: number): Promise<void> {
  await page.goto(`/dashboard/accounts/${accountId}/transactions`)
  await expect(page.getByRole('heading', { name: 'Transactions', level: 2 })).toBeVisible()
}

test('1 own-account transfer shows receipt, balances, and exactly two ledger rows', async ({ browser }, testInfo) => {
  const customer = await createCustomer(browser, 'Morgan', 'One')
  const before = inspect(customer.email)
  const checkingBefore = before.accounts.find((account) => account.type === 'checking')!.balance_cents
  const savingsBefore = before.accounts.find((account) => account.type === 'savings')!.balance_cents
  const page = await customer.context.newPage()
  await openOwnTransferReview(page, '50.00')
  await expect(page.getByText('$50.00', { exact: true })).toBeVisible()
  await expect(page.getByRole('definition').filter({ hasText: '$960.00' })).toBeVisible()
  await confirmTransfer(page)
  const reference = await page.locator('main').getByText(/^[0-9A-HJKMNP-TV-Z]{20,30}$/).textContent()
  expect(reference).toBeTruthy()

  const after = inspect(customer.email)
  const transfer = after.transfers.find((item) => !before.transfers.some((old) => old.id === item.id))
  expect(transfer).toBeTruthy()
  expect(transfer!.amount_cents).toBe(5000)
  const ledgerRows = after.transactions.filter((item) => item.transfer_id === transfer!.id)
  expect(ledgerRows).toHaveLength(2)
  expect(ledgerRows.map((row) => row.direction).sort()).toEqual(['credit', 'debit'])
  expect(after.accounts.find((account) => account.type === 'checking')!.balance_cents).toBe(checkingBefore - 5000)
  expect(after.accounts.find((account) => account.type === 'savings')!.balance_cents).toBe(savingsBefore + 5000)

  await page.getByRole('button', { name: 'Make another transfer' }).click()
  const accountOptions = await page.getByLabel('From account').locator('option').allTextContents()
  expect(accountOptions.some((option) => option.includes('$960.00'))).toBe(true)
  expect(accountOptions.some((option) => option.includes('$50.00'))).toBe(true)
  testInfo.attach('database-transfer.json', { body: JSON.stringify({ transfer, ledgerRows }, null, 2), contentType: 'application/json' })
})

test('2 transfer to another customer verifies masked lookup and both transaction views', async ({ browser }) => {
  const sender = await createCustomer(browser, 'Avery', 'Sender')
  const recipient = await createCustomer(browser, 'Jordan', 'Receiver')
  const senderPage = await sender.context.newPage()
  await sendExternalTransfer(senderPage, recipient.checking.account_number, '25.00', 'J*** R***')
  await confirmTransfer(senderPage)

  const sent = inspect(sender.email)
  const received = inspect(recipient.email)
  const transfer = sent.transfers.find((item) => item.amount_cents === 2500)
  expect(transfer).toBeTruthy()
  const debit = sent.transactions.find((row) => row.transfer_id === transfer!.id && row.direction === 'debit')
  const credit = received.transactions.find((row) => row.transfer_id === transfer!.id && row.direction === 'credit')
  expect(debit?.amount_cents).toBe(2500)
  expect(credit?.amount_cents).toBe(2500)
  expect(received.accounts.find((account) => account.id === recipient.checking.id)!.balance_cents).toBe(recipient.checking.balance_cents + 2500)

  await visitAccountTransactions(senderPage, sender.checking.id)
  const sentRow = senderPage.getByRole('table').getByRole('row').filter({ hasText: '$25.00' })
  await expect(sentRow).toBeVisible()

  const recipientPage = await recipient.context.newPage()
  await visitAccountTransactions(recipientPage, recipient.checking.id)
  const receivedRow = recipientPage.getByRole('table').getByRole('row').filter({ hasText: '$25.00' })
  await expect(receivedRow).toBeVisible()
})

test('3 rapid double-click and Enter confirmation creates one transfer and one debit', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Casey', 'Double')
  const page = await customer.context.newPage()
  await openOwnTransferReview(page, '10.00')
  let requests = 0
  await page.route('**/api/v1/transfers', async (route) => {
    if (route.request().method() === 'POST') {
      requests += 1
      await new Promise((resolve) => setTimeout(resolve, 300))
    }
    await route.continue()
  })

  const confirm = page.getByRole('button', { name: 'Confirm transfer' })
  await confirm.dblclick({ delay: 10 }).catch(() => undefined)
  await page.keyboard.press('Enter').catch(() => undefined)
  await page.keyboard.press('Enter').catch(() => undefined)
  await expect(page.getByRole('heading', { name: 'Transfer complete' })).toBeVisible()
  expect(requests).toBe(1)

  const state = inspect(customer.email)
  expect(state.transfers).toHaveLength(1)
  expect(state.transactions.filter((row) => row.direction === 'debit' && row.transfer_id === state.transfers[0].id)).toHaveLength(1)
})

test('4 retry after a network abort reuses the same idempotency key and moves money once', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Riley', 'Retry')
  const page = await customer.context.newPage()
  await openOwnTransferReview(page, '7.25')
  let postCount = 0
  const idempotencyKeys: string[] = []
  await page.route('**/api/v1/transfers', async (route) => {
    if (route.request().method() === 'POST') {
      postCount += 1
      idempotencyKeys.push((await route.request().allHeaders())['idempotency-key'] ?? '')
      if (postCount === 1) return route.abort('failed')
    }
    await route.continue()
  })

  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to connect')
  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Transfer complete' })).toBeVisible()
  expect(postCount).toBe(2)
  expect(idempotencyKeys[0]).toMatch(/^[0-9a-f-]{36}$/i)
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0])

  const state = inspect(customer.email)
  expect(state.transfers).toHaveLength(1)
  expect(state.transactions.filter((row) => row.transfer_id === state.transfers[0].id)).toHaveLength(2)
})

test('5 insufficient funds error keeps the entered details and creates no transfer rows', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Taylor', 'LowFunds', 100)
  const page = await customer.context.newPage()
  await openTransfers(page)
  await page.getByLabel('Amount in dollars').fill('2000.00')
  await expect(page.getByText('This amount is more than the available balance.')).toBeVisible()
  await page.getByRole('button', { name: 'Review transfer' }).click()
  await expect(page.getByRole('heading', { name: 'Review', level: 3 })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('alert')).toContainText('does not have enough available funds')
  await expect(page.getByRole('definition').filter({ hasText: '$2,000.00' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review', level: 3 })).toBeVisible()
  const state = inspect(customer.email)
  expect(state.transfers).toHaveLength(0)
  expect(state.transactions.filter((row) => row.category === 'transfer')).toHaveLength(0)
})

test('6 next transfer after the daily cap returns daily_limit_exceeded and limits is zero', async ({ browser }) => {
  const sender = await createCustomer(browser, 'Quinn', 'Limit', 600000)
  const recipient = await createCustomer(browser, 'Robin', 'LimitTarget', 100)
  const page = await sender.context.newPage()
  await sendExternalTransfer(page, recipient.checking.account_number, '5000.00', 'R*** L***')
  await confirmTransfer(page)

  await page.getByRole('button', { name: 'Make another transfer' }).click()
  await sendExternalTransfer(page, recipient.checking.account_number, '0.01', 'R*** L***')
  await page.getByRole('button', { name: 'Confirm transfer' }).click()
  await expect(page.getByRole('alert')).toContainText('exceeds your remaining daily limit')
  await expect(page.getByRole('definition').filter({ hasText: '$0.01' })).toBeVisible()

  const limits = await getApi<{ data: { used_today_cents: number; remaining_cents: number } }>(sender.context, '/v1/limits')
  expect(limits.data.used_today_cents).toBe(500000)
  expect(limits.data.remaining_cents).toBe(0)
  expect(inspect(sender.email).transfers.filter((transfer) => transfer.status === 'completed')).toHaveLength(1)
})

test('7 bill payment is visible in Transactions and reduces the daily limit', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Sam', 'Biller', 100000)
  const page = await customer.context.newPage()
  const initialLimits = await getApi<{ data: { remaining_cents: number } }>(customer.context, '/v1/limits')
  await page.goto('/dashboard/bills')
  await expect(page.getByRole('heading', { name: 'Bill payments', level: 2 })).toBeVisible()
  await page.getByRole('button', { name: /Northstar Electric/ }).click()
  await page.getByLabel('Reference number').fill('NE12345678')
  await page.getByLabel('Amount in dollars').fill('12.34')
  await page.getByRole('button', { name: 'Review payment' }).click()
  await expect(page.getByRole('heading', { name: 'Review', level: 3 })).toBeVisible()
  await expect(page.getByText('$12.34', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm payment' }).click()
  await expect(page.getByRole('heading', { name: 'Payment complete' })).toBeVisible()

  const state = inspect(customer.email)
  expect(state.bill_payments).toHaveLength(1)
  expect(state.transactions.some((row) => row.category === 'bill_payment' && row.amount_cents === 1234)).toBe(true)
  const limits = await getApi<{ data: { remaining_cents: number } }>(customer.context, '/v1/limits')
  expect(limits.data.remaining_cents).toBe(initialLimits.data.remaining_cents - 1234)

  await visitAccountTransactions(page, customer.checking.id)
  await expect(page.getByRole('table').getByText('Bill payment: Northstar Electric')).toBeVisible()
  await expect(page.getByRole('table').getByText('Bill payment', { exact: true })).toBeVisible()
})

test('8 another customer opening a transfer URL receives not found with no transfer data', async ({ browser }) => {
  const sender = await createCustomer(browser, 'Dana', 'Owner')
  const other = await createCustomer(browser, 'Lee', 'Other')
  const senderPage = await sender.context.newPage()
  await openOwnTransferReview(senderPage, '2.00')
  await confirmTransfer(senderPage)
  const transferId = inspect(sender.email).transfers[0].id
  const directResponse = await other.context.request.get(`${apiRoot}/v1/transfers/${transferId}`, { headers: standardHeaders() })
  expect(directResponse.status()).toBe(404)
  const otherPage = await other.context.newPage()
  await otherPage.goto(`/dashboard/transfers/${transferId}`)
  await expect(otherPage.getByRole('alert')).toContainText('could not be found', { timeout: 30_000 })
  await expect(otherPage.getByText(transferId)).toHaveCount(0)
  await expect(otherPage.getByText('$2.00', { exact: true })).toHaveCount(0)
})

test('9 Arabic own-account transfer keeps money LTR and shows the correct receipt', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Amal', 'Arabic')
  const page = await customer.context.newPage()
  await page.goto('/')
  await page.evaluate(() => localStorage.setItem('westbridge.lang', 'ar'))
  await page.reload()
  await page.goto('/dashboard/transfers')
  await expect(page.getByRole('heading', { name: 'التحويلات', level: 2 })).toBeVisible()
  await page.getByLabel('المبلغ بالدولار').fill('50.00')
  await page.getByRole('button', { name: 'مراجعة التحويل' }).click()
  await expect(page.getByRole('heading', { name: 'المراجعة', level: 3 })).toBeVisible()
  await expect(page.locator('bdi').filter({ hasText: '50.00' }).first()).toHaveAttribute('dir', 'ltr')
  await page.getByRole('button', { name: 'تأكيد التحويل' }).click()
  await expect(page.getByRole('heading', { name: 'اكتمل التحويل' })).toBeVisible()
  await expect(page.locator('bdi').filter({ hasText: '50.00' }).first()).toHaveAttribute('dir', 'ltr')
  const state = inspect(customer.email)
  expect(state.transfers[0].amount_cents).toBe(5000)
  expect(state.transactions.filter((row) => row.transfer_id === state.transfers[0].id)).toHaveLength(2)
})

test('10 card freeze declines without a ledger row; unfreeze approves one card-linked debit', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Card', 'Freeze', 50000)
  const created = await postApi<{ data: { id: number } }>(customer.context, '/v1/cards', { account_id: customer.checking.id, nickname: 'Everyday test' })
  const page = await customer.context.newPage()
  await page.goto('/dashboard/cards')
  await expect(page.getByRole('heading', { name: 'Cards', level: 2 })).toBeVisible()
  await page.getByRole('switch', { name: 'Freeze card' }).click()
  await expect(page.getByText('Frozen', { exact: true }).first()).toBeVisible()
  const before = inspect(customer.email)
  await page.getByRole('button', { name: 'Try a test purchase' }).click()
  await page.getByLabel('Merchant').fill('Neighborhood Market')
  await page.getByLabel('Amount in dollars').fill('5.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText('This card is frozen')
  expect(inspect(customer.email).transactions).toHaveLength(before.transactions.length)
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('switch', { name: 'Unfreeze card' }).click()
  await expect(page.getByRole('switch', { name: 'Freeze card' })).toBeVisible()
  await page.getByRole('button', { name: 'Try a test purchase' }).click()
  await page.getByLabel('Merchant').fill('Neighborhood Market')
  await page.getByLabel('Amount in dollars').fill('5.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText('Approved')
  const after = inspect(customer.email)
  const purchase = after.transactions.find((row) => row.card_id === created.data.id)
  expect(purchase?.amount_cents).toBe(500)
  expect(purchase?.category).toBe('card')
  expect(after.accounts.find((account) => account.id === customer.checking.id)!.balance_cents).toBe(customer.checking.balance_cents + 50000 - 500)
})

test('11 card daily limit applies only to that card and permits an in-limit purchase', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Card', 'Limit', 50000)
  const created = await postApi<{ data: { id: number } }>(customer.context, '/v1/cards', { account_id: customer.checking.id, nickname: 'Limit test' })
  await patchApi(customer.context, `/v1/cards/${created.data.id}`, { daily_limit_cents: 1000 })
  const page = await customer.context.newPage()
  await page.goto('/dashboard/cards')
  await page.getByRole('button', { name: 'Try a test purchase' }).click()
  await page.getByLabel('Merchant').fill('Limit Shop')
  await page.getByLabel('Amount in dollars').fill('15.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText("exceeds this card's daily limit")
  await page.getByLabel('Amount in dollars').fill('9.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText('Approved')
  const state = inspect(customer.email)
  expect(state.transactions.filter((row) => row.card_id === created.data.id)).toHaveLength(1)
  expect(state.transactions.find((row) => row.card_id === created.data.id)?.amount_cents).toBe(900)
})

test('12 three active cards block a fourth until one is permanently cancelled', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Card', 'Maximum')
  const cardIds: number[] = []
  for (let index = 0; index < 3; index += 1) {
    const card = await postApi<{ data: { id: number } }>(customer.context, '/v1/cards', { account_id: customer.checking.id, nickname: `Card ${index + 1}` })
    cardIds.push(card.data.id)
  }
  const page = await customer.context.newPage()
  await page.goto('/dashboard/cards')
  await page.getByRole('button', { name: 'Request virtual card' }).click()
  await expect(page.getByText('You have reached the maximum of three active cards.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Request virtual card' }).last()).toBeDisabled()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.getByRole('button', { name: /Card 1/ }).click()
  await page.getByRole('button', { name: 'Cancel card' }).click()
  await page.getByLabel('Type CANCEL to continue').fill('CANCEL')
  await page.getByRole('button', { name: 'Cancel card' }).last().click()
  await expect(page.getByText('Cancelled', { exact: true }).first()).toBeVisible()
  await page.getByRole('button', { name: 'Request virtual card' }).first().click()
  await page.getByLabel('Card nickname').fill('Replacement')
  await page.getByRole('button', { name: 'Request virtual card' }).last().click()
  await expect(page.getByText('Replacement', { exact: true }).first()).toBeVisible()
  expect(inspect(customer.email).cards.filter((card) => card.status !== 'cancelled')).toHaveLength(3)
  expect(inspect(customer.email).cards.find((card) => card.id === cardIds[0])?.status).toBe('cancelled')
})

test('13 received transfer appears in the bell with the amount and clears when read', async ({ browser }) => {
  const sender = await createCustomer(browser, 'Nora', 'Sender', 20000)
  const recipient = await createCustomer(browser, 'Omar', 'Receiver', 100)
  const senderPage = await sender.context.newPage()
  await sendExternalTransfer(senderPage, recipient.checking.account_number, '12.34', 'O*** R***')
  await confirmTransfer(senderPage)

  const page = await recipient.context.newPage()
  await page.goto('/dashboard')
  const bell = page.getByRole('button', { name: '1 unread notification' })
  await expect(bell).toBeVisible()
  await bell.click()
  await expect(page.getByText('You received $12.34 from N*** S***.')).toBeVisible()
  await page.getByRole('link', { name: 'View all notifications' }).click()
  await page.getByRole('button', { name: 'Mark as read' }).click()
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  expect(JSON.parse(inspect(recipient.email).notifications[0].data)).toEqual({ type: 'transfer_received', params: { amount_cents: 1234, from_masked: 'N*** S***', reference: expect.any(String) } })
})

test('14 password change keeps current browser, revokes another session and rejects the old password', async ({ browser }) => {
  const original = await createCustomer(browser, 'Paige', 'Password', 1000)
  const second = await loginCustomer(browser, original.email)
  const page = await original.context.newPage()
  await page.goto('/dashboard/settings?tab=security')
  await page.getByLabel('Current password').fill('E2eSecurePass123')
  await page.getByLabel('New password', { exact: true }).fill('E2eChangedPass456')
  await page.getByLabel('Confirm new password').fill('E2eChangedPass456')
  const mailLogPath = path.join(serverRoot, 'storage/logs/laravel.log')
  const mailLogBefore = readFileSync(mailLogPath, 'utf8')
  await page.getByRole('button', { name: 'Update password' }).click()
  await expect(page.getByText('Password changed. Other devices were signed out.')).toBeVisible()
  const secondSession = await second.context.request.get(`${apiRoot}/v1/auth/me`, { headers: standardHeaders() })
  expect(secondSession.status()).toBe(401)
  const csrfResponse = await second.context.request.get(`${apiOrigin}/sanctum/csrf-cookie`, { headers: standardHeaders() })
  expect(csrfResponse.ok()).toBeTruthy()
  const csrfCookie = (await second.context.cookies(apiOrigin)).find((cookie) => cookie.name === 'XSRF-TOKEN')
  expect(csrfCookie).toBeTruthy()
  const oldLogin = await second.context.request.post(`${apiRoot}/v1/auth/login`, {
    headers: { ...standardHeaders(), 'Content-Type': 'application/json', 'X-XSRF-TOKEN': decodeURIComponent(csrfCookie!.value) },
    data: { email: original.email, password: 'E2eSecurePass123' },
  })
  expect(oldLogin.status()).toBe(422)
  const state = inspect(original.email)
  expect(state.notifications.some((item) => JSON.parse(item.data).type === 'password_changed')).toBe(true)
  const mailLogAfter = readFileSync(mailLogPath, 'utf8')
  expect(mailLogAfter.slice(mailLogBefore.length)).toContain('Your Westbridge password was changed')
})

test('15 sessions page lists opaque devices and revocation signs out the other session', async ({ browser }) => {
  const primary = await createCustomer(browser, 'Rene', 'Devices', 1000)
  const second = await loginCustomer(browser, primary.email)
  const secondPage = await second.context.newPage()
  await secondPage.goto('/dashboard')
  await expect(secondPage.getByText('Total balance')).toBeVisible()
  const page = await primary.context.newPage()
  await page.goto('/dashboard/settings?tab=security')
  await expect(page.getByText('This device')).toBeVisible()
  const revoke = page.getByRole('button', { name: 'Revoke session' })
  await expect(revoke).toHaveCount(1)
  page.once('dialog', (dialog) => dialog.accept())
  await revoke.click()
  const me = await second.context.request.get(`${apiRoot}/v1/auth/me`, { headers: standardHeaders() })
  expect(me.status()).toBe(401)
  await secondPage.reload()
  await expect(secondPage).toHaveURL(/\/login\?redirect=/)
})

test('16 server locale and theme persist across fresh login without an initial language flash', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Ari', 'Preferences')
  await patchApi(customer.context, '/v1/settings/preferences', { locale: 'ar', theme: 'dark' })
  await customer.context.clearCookies()
  const fresh = await loginCustomer(browser, customer.email)
  const page = await fresh.context.newPage()
  await page.goto('/dashboard')
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(page.getByRole('heading', { name: 'Overview' })).toHaveCount(0)
  await expect(page.getByRole('heading', { name: /مرحبا|مرحبًا/ })).toBeVisible()
})

test('17 insights monthly totals match independent ledger sums excluding own transfers', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Inez', 'Insights', 20000)
  const ownPage = await customer.context.newPage()
  await openOwnTransferReview(ownPage, '10.00')
  await confirmTransfer(ownPage)
  const state = inspect(customer.email)
  const month = new Date().toISOString().slice(0, 7)
  const ownAccountIds = new Set(state.accounts.map((account) => account.id))
  const ownTransferIds = new Set(state.transfers.filter((transfer) => ownAccountIds.has(transfer.from_account_id) && ownAccountIds.has(transfer.to_account_id)).map((transfer) => transfer.id))
  const monthRows = state.transactions.filter((row) => row.posted_at.startsWith(month) && (row.transfer_id === null || !ownTransferIds.has(row.transfer_id)))
  const income = monthRows.filter((row) => row.direction === 'credit').reduce((sum, row) => sum + row.amount_cents, 0)
  const spending = monthRows.filter((row) => row.direction === 'debit').reduce((sum, row) => sum + row.amount_cents, 0)
  const insight = await getApi<{ data: { income_cents: number; spending_cents: number } }>(customer.context, `/v1/insights?month=${month}`)
  expect(insight.data.income_cents).toBe(income)
  expect(insight.data.spending_cents).toBe(spending)
  const page = await customer.context.newPage()
  await page.goto(`/dashboard/insights?month=${month}`)
  await expect(page.getByRole('heading', { name: 'Insights', level: 2 })).toBeVisible()
  await expect(page.getByText(new Intl.NumberFormat('en', { style: 'currency', currency: 'USD' }).format(income / 100), { exact: true }).first()).toBeVisible()
  if (income === 0) await expect(page.getByText('N/A')).toBeVisible()
})

test('18 low-balance notification is emitted once per dip and resets after recovery', async ({ browser }) => {
  const customer = await createCustomer(browser, 'Luca', 'LowBalance', 200000)
  await patchApi(customer.context, '/v1/settings/preferences', { low_balance_threshold_cents: 290000 })
  const card = await postApi<{ data: { id: number } }>(customer.context, '/v1/cards', { account_id: customer.checking.id })
  const page = await customer.context.newPage()
  await page.goto('/dashboard/cards')
  await page.getByRole('button', { name: 'Try a test purchase' }).click()
  await page.getByLabel('Merchant').fill('Low Balance Shop')
  await page.getByLabel('Amount in dollars').fill('200.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText('Approved')
  let low = inspect(customer.email).notifications.filter((item) => JSON.parse(item.data).type === 'low_balance')
  expect(low).toHaveLength(1)
  await page.getByLabel('Amount in dollars').fill('10.00')
  await page.getByRole('button', { name: 'Submit test purchase' }).click()
  await expect(page.getByRole('status')).toContainText('Approved')
  runE2eCommand('dev:e2e-fund', [customer.email, '50000'])
  const refreshedCard = (await getApi<{ data: { id: number }[] }>(customer.context, '/v1/cards')).data.find((item) => item.id === card.data.id)!
  await postApi(customer.context, `/v1/cards/${refreshedCard.id}/test-purchase`, { merchant: 'Second Shop', amount_cents: 40000 })
  low = inspect(customer.email).notifications.filter((item) => JSON.parse(item.data).type === 'low_balance')
  expect(inspect(customer.email).accounts[0].balance_cents).toBe(289000)
  expect(low).toHaveLength(2)
})
