<?php

namespace App\Enums;

enum CardStatus: string
{
    case Active = 'active';
    case Frozen = 'frozen';
    case Cancelled = 'cancelled';
}
