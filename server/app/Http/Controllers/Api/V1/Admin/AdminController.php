<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\AccountStatus;
use App\Enums\TicketPriority;
use App\Enums\TicketStatus;
use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\AdminAuditLogResource;
use App\Http\Resources\Admin\AdminTicketMessageResource;
use App\Http\Resources\Admin\AdminTicketResource;
use App\Http\Resources\Admin\AdminTransactionResource;
use App\Http\Resources\Admin\AdminUserDetailResource;
use App\Http\Resources\Admin\AdminUserResource;
use App\Models\Account;
use App\Models\SupportTicket;
use App\Models\User;
use App\Services\Admin\AdminService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class AdminController extends Controller
{
    public function __construct(private readonly AdminService $admin) {}

    public function overview(): JsonResponse
    {
        $data = $this->admin->overview();
        $data['latest_audit'] = AdminAuditLogResource::collection($data['latest_audit'])->resolve();
        return response()->json(['data' => $data]);
    }

    public function reconcile(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->admin->reconcile($request->user(), $request)]);
    }

    public function users(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'status' => ['nullable', Rule::in(['active', 'suspended'])],
            'role' => ['nullable', Rule::in(['customer', 'admin'])],
            'verified' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['created_at', 'last_login_at', 'name'])],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
            ...$this->paginationRules(),
        ]);
        return AdminUserResource::collection($this->admin->users($filters));
    }

    public function user(User $user): JsonResponse
    {
        return response()->json(['data' => (new AdminUserDetailResource($this->admin->userDetail($user)))->resolve()]);
    }

    public function suspend(Request $request, User $user): JsonResponse
    {
        $data = $this->validateWrite($request);
        $this->admin->suspendOrReactivate($request->user(), $user, true, $data, $request);
        return response()->json(['data' => ['updated' => true]]);
    }

    public function reactivate(Request $request, User $user): JsonResponse
    {
        $data = $this->validateWrite($request);
        $this->admin->suspendOrReactivate($request->user(), $user, false, $data, $request);
        return response()->json(['data' => ['updated' => true]]);
    }

    public function freeze(Request $request, Account $account): JsonResponse
    {
        $data = $this->validateWrite($request);
        $this->admin->freezeOrUnfreeze($request->user(), $account, true, $data, $request);
        return response()->json(['data' => ['updated' => true]]);
    }

    public function unfreeze(Request $request, Account $account): JsonResponse
    {
        $data = $this->validateWrite($request);
        $this->admin->freezeOrUnfreeze($request->user(), $account, false, $data, $request);
        return response()->json(['data' => ['updated' => true]]);
    }

    public function transactions(Request $request)
    {
        $filters = $request->validate([
            'q' => ['nullable', 'string', 'max:100'],
            'user_email' => ['nullable', 'string', 'max:254'],
            'direction' => ['nullable', Rule::in(['credit', 'debit'])],
            'category' => ['nullable', Rule::in(['transfer', 'deposit', 'withdrawal', 'bill_payment', 'card', 'fee', 'interest', 'other'])],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            'min_amount_cents' => ['nullable', 'integer', 'min:0'],
            'max_amount_cents' => ['nullable', 'integer', 'min:0', 'gte:min_amount_cents'],
            'large_only' => ['nullable', 'boolean'],
            'sort' => ['nullable', Rule::in(['posted_at', 'amount_cents'])],
            'order' => ['nullable', Rule::in(['asc', 'desc'])],
            ...$this->paginationRules(),
        ]);
        return AdminTransactionResource::collection($this->admin->transactions($filters));
    }

    public function tickets(Request $request)
    {
        $filters = $request->validate([
            'status' => ['nullable', Rule::in(array_column(TicketStatus::cases(), 'value'))],
            'priority' => ['nullable', Rule::in(array_column(TicketPriority::cases(), 'value'))],
            'q' => ['nullable', 'string', 'max:100'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            ...$this->paginationRules(),
        ]);
        return AdminTicketResource::collection($this->admin->tickets($filters));
    }

    public function ticket(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['user', 'messages.admin']);
        return response()->json(['data' => (new AdminTicketResource($ticket))->resolve()]);
    }

    public function updateTicket(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $this->validateWrite($request, [
            'status' => ['sometimes', Rule::in(array_column(TicketStatus::cases(), 'value'))],
            'priority' => ['sometimes', Rule::in(array_column(TicketPriority::cases(), 'value'))],
        ]);
        return response()->json(['data' => (new AdminTicketResource($this->admin->updateTicket($request->user(), $ticket, $data, $request)))->resolve()]);
    }

    public function ticketMessage(Request $request, SupportTicket $ticket): JsonResponse
    {
        $message = $this->admin->addTicketMessage($request->user(), $ticket, $this->validateWrite($request, [
            'type' => ['required', Rule::in(['note', 'reply'])],
            'body' => ['required', 'string', 'min:1', 'max:5000'],
        ]), $request);
        return response()->json(['data' => (new AdminTicketMessageResource($message))->resolve()], 201);
    }

    public function auditLogs(Request $request)
    {
        $filters = $request->validate([
            'action' => ['nullable', 'string', 'max:100'],
            'actor_email' => ['nullable', 'string', 'max:254'],
            'entity_type' => ['nullable', 'string', 'max:80'],
            'entity_id' => ['nullable', 'string', 'max:40'],
            'ip_address' => ['nullable', 'string', 'max:45'],
            'date_from' => ['nullable', 'date_format:Y-m-d'],
            'date_to' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:date_from'],
            ...$this->paginationRules(),
        ]);
        return AdminAuditLogResource::collection($this->admin->auditLogs($filters));
    }

    public function auditActions(): JsonResponse
    {
        return response()->json(['data' => $this->admin->actions()]);
    }

    private function validateWrite(Request $request, array $rules = []): array
    {
        return $request->validate([...$rules,
            'reason' => ['required', 'string', 'min:10', 'max:500'],
            'password' => ['required', 'string'],
        ], [
            'reason.required' => 'validation.reason_required',
            'reason.min' => 'validation.reason_min',
            'reason.max' => 'validation.reason_max',
        ]);
    }

    private function paginationRules(): array
    {
        return [
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.(int) config('bank.admin_per_page_max', 100)],
        ];
    }
}
