// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NotFound } from '@/pages/NotFound'
import { RequireRole } from '@/features/auth/guards'
import { AdminSupportPage, AdminUserDetailPage, AdminUsersPage, dollarsToCents } from './AdminPages'

const mocks = vi.hoisted(() => ({
  user: null as { id: number; role: 'customer'|'admin'; first_name:string; last_name:string; email:string; email_verified:boolean; created_at:string } | null,
  getUsers: vi.fn(), getUser: vi.fn(), changeUserState: vi.fn(), changeAccountState: vi.fn(), getTicket: vi.fn(), getTickets: vi.fn(),
  sendTicketMessage: vi.fn(), updateTicket: vi.fn(), getOverview: vi.fn(), reconcile: vi.fn(), getTransactions: vi.fn(), getAuditLogs: vi.fn(), getAuditActions: vi.fn(), toastSuccess: vi.fn(), toastError: vi.fn(),
}))

vi.mock('@/features/auth/auth-provider', () => ({ useAuth: () => ({ user: mocks.user, isLoading: false, logout: vi.fn() }) }))
vi.mock('./api', () => ({
  getUsers: mocks.getUsers, getUser: mocks.getUser, changeUserState: mocks.changeUserState, changeAccountState: mocks.changeAccountState,
  getTicket: mocks.getTicket, getTickets: mocks.getTickets, sendTicketMessage: mocks.sendTicketMessage, updateTicket: mocks.updateTicket,
  getOverview: mocks.getOverview, reconcile: mocks.reconcile, getTransactions: mocks.getTransactions, getAuditLogs: mocks.getAuditLogs, getAuditActions: mocks.getAuditActions,
}))
vi.mock('sonner', () => ({ toast: { success: mocks.toastSuccess, error: mocks.toastError } }))

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.user = null })
const query = () => new QueryClient({ defaultOptions: { queries: { retry: false } } })
function Location() { const location=useLocation(); return <output data-testid="search">{location.search}</output> }
function wrap(ui:React.ReactNode, initial='/admin') { return render(<QueryClientProvider client={query()}><MemoryRouter initialEntries={[initial]}>{ui}<Location/></MemoryRouter></QueryClientProvider>) }

const page = <T,>(data:T[]) => ({data,links:{},meta:{current_page:1,last_page:1,per_page:20,total:data.length}})
const userDetail = (role:'customer'|'admin'='customer') => ({ id:3,first_name:'Jamie',last_name:'River',email:'jamie@example.test',phone:null,role,status:'active',email_verified:true,created_at:'2026-01-01T00:00:00Z',last_login_at:null,accounts:[],cards_count:0,open_tickets_count:0,active_sessions_count:1,transactions:[],audit_events:[] })
const ticket = {id:5,user_id:3,user:{id:3,name:'Jamie River',email:'jamie@example.test'},name:'Jamie River',email:'jamie@example.test',subject:'Question',message:'Initial request',status:'open',priority:'normal',created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',messages:[]}

describe('Admin panel',()=>{
  it('shows the existing not-found page for customers and renders the protected child for admins', async()=>{
    mocks.user={id:1,role:'customer',first_name:'Sam',last_name:'User',email:'sam@example.test',email_verified:true,created_at:'2026-01-01T00:00:00Z'}
    const view=wrap(<Routes><Route path="/admin" element={<RequireRole role="admin"><p>Admin content</p></RequireRole>}/><Route path="*" element={<NotFound/>}/></Routes>)
    expect(await screen.findByText('Page not found')).toBeTruthy()
    view.unmount()
    mocks.user={id:2,role:'admin',first_name:'Alex',last_name:'Admin',email:'admin@example.test',email_verified:true,created_at:'2026-01-01T00:00:00Z'}
    wrap(<RequireRole role="admin"><p>Admin content</p></RequireRole>)
    expect(await screen.findByText('Admin content')).toBeTruthy()
  })

  it('reads and writes user filters in the URL', async()=>{
    mocks.getUsers.mockResolvedValue(page([]))
    wrap(<Routes><Route path="/admin/users" element={<AdminUsersPage/>}/></Routes>,'/admin/users?q=Jamie&status=active')
    await waitFor(()=>expect(mocks.getUsers).toHaveBeenCalled())
    expect(mocks.getUsers.mock.calls[0][0]).toMatchObject({q:'Jamie',status:'active'})
    fireEvent.change(screen.getByLabelText('Status'),{target:{value:'suspended'}})
    await waitFor(()=>expect(new URLSearchParams(screen.getByTestId('search').textContent??'').get('status')).toBe('suspended'))
  })

  it('requires reason and current password before submitting a user suspension and disables admin targets', async()=>{
    mocks.getUser.mockResolvedValue(userDetail())
    mocks.changeUserState.mockResolvedValue(undefined)
    wrap(<Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage/>}/></Routes>,'/admin/users/3')
    fireEvent.click(await screen.findByRole('button',{name:'Suspend user'}))
    const confirm=screen.getByRole('button',{name:'Confirm action'})
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Reason'),{target:{value:'Review confirmed fraud'}})
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Current password'),{target:{value:'AdminPass123!'}})
    expect((confirm as HTMLButtonElement).disabled).toBe(false)
    fireEvent.click(confirm)
    await waitFor(()=>expect(mocks.changeUserState).toHaveBeenCalledWith(3,'suspend',{reason:'Review confirmed fraud',password:'AdminPass123!'}))

    cleanup();vi.clearAllMocks();mocks.getUser.mockResolvedValue(userDetail('admin'))
    wrap(<Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage/>}/></Routes>,'/admin/users/3')
    const disabled=await screen.findByRole('button',{name:'Suspend user'})
    expect((disabled as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Administrators cannot change their own account or another administrator.')).toBeTruthy()
  })

  it('shows the recipient confirmation for replies but not internal notes',async()=>{
    mocks.getTicket.mockResolvedValue(ticket)
    wrap(<Routes><Route path="/admin/support/:ticketId" element={<AdminSupportPage/>}/></Routes>,'/admin/support/5')
    await screen.findByText('Question')
    expect(screen.getByText('This note is internal and will not be emailed.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button',{name:'Reply to customer'}))
    expect(screen.getByText('This reply will be emailed to jamie@example.test.')).toBeTruthy()
  })

  it('converts dollar amounts to integer cents without floating point',()=>{
    expect(dollarsToCents('10')).toBe(1000)
    expect(dollarsToCents('10.5')).toBe(1050)
    expect(dollarsToCents('10.05')).toBe(1005)
    expect(dollarsToCents('0.009')).toBeNull()
    expect(dollarsToCents('-1.00')).toBeNull()
  })
})
