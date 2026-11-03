<?php

namespace App\Policies;

use App\Models\Account;
use App\Models\User;
use Illuminate\Auth\Access\Response;

class AccountPolicy
{
    public function viewAny(User $user): bool
    {
        return true;
    }

    public function view(User $user, Account $account): Response
    {
        return $account->user_id === $user->getKey()
            ? Response::allow()
            : Response::denyAsNotFound();
    }
}
