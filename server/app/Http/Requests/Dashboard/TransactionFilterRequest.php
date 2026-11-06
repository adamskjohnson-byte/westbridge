<?php

namespace App\Http\Requests\Dashboard;

use App\Enums\TransactionCategory;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class TransactionFilterRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $category = $this->query('category');
        $queryString = (string) $this->server('QUERY_STRING', '');
        $repeatedCategories = [];
        foreach (explode('&', $queryString) as $pair) {
            [$key, $value] = array_pad(explode('=', $pair, 2), 2, '');
            if (in_array(urldecode($key), ['category', 'category[]'], true)) {
                $repeatedCategories[] = urldecode($value);
            }
        }

        if ($repeatedCategories !== []) {
            $this->merge(['category' => $repeatedCategories]);
        } elseif (is_string($category)) {
            $this->merge(['category' => [$category]]);
        }
    }

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'page' => ['sometimes', 'integer', 'min:1'],
            'per_page' => ['sometimes', 'integer', 'min:1', 'max:50'],
            'card_id' => ['sometimes', 'integer', 'min:1'],
            'q' => ['sometimes', 'string', 'max:100'],
            'direction' => ['sometimes', Rule::in(['credit', 'debit'])],
            'category' => ['sometimes', 'array', 'min:1', 'max:8', static function (string $attribute, mixed $value, \Closure $fail): void {
                $allowed = array_map(static fn (TransactionCategory $category): string => $category->value, TransactionCategory::cases());
                foreach ((array) $value as $category) {
                    if (! is_string($category) || ! in_array($category, $allowed, true)) {
                        $fail('validation.category_invalid');

                        return;
                    }
                }
            }],
            'date_from' => ['sometimes', 'date_format:Y-m-d'],
            'date_to' => ['sometimes', 'date_format:Y-m-d'],
            'min_amount_cents' => ['sometimes', 'integer', 'min:0'],
            'max_amount_cents' => ['sometimes', 'integer', 'min:0'],
            'sort' => ['sometimes', Rule::in(['posted_at', 'amount_cents'])],
            'order' => ['sometimes', Rule::in(['asc', 'desc'])],
        ];
    }

    public function messages(): array
    {
        return [
            'page.integer' => 'validation.page_invalid',
            'page.min' => 'validation.page_invalid',
            'per_page.integer' => 'validation.per_page_invalid',
            'per_page.min' => 'validation.per_page_invalid',
            'per_page.max' => 'validation.per_page_invalid',
            'q.string' => 'validation.query_invalid',
            'q.max' => 'validation.query_max',
            'direction.in' => 'validation.direction_invalid',
            'category.array' => 'validation.category_invalid',
            'category.min' => 'validation.category_invalid',
            'category.max' => 'validation.category_invalid',
            'date_from.date_format' => 'validation.date_invalid',
            'date_to.date_format' => 'validation.date_invalid',
            'min_amount_cents.integer' => 'validation.amount_invalid',
            'min_amount_cents.min' => 'validation.amount_invalid',
            'max_amount_cents.integer' => 'validation.amount_invalid',
            'max_amount_cents.min' => 'validation.amount_invalid',
            'sort.in' => 'validation.sort_invalid',
            'order.in' => 'validation.order_invalid',
        ];
    }

    public function withValidator(Validator $validator): void
    {
        $validator->after(function (Validator $validator): void {
            if ($validator->errors()->isNotEmpty()) {
                return;
            }

            $dateFrom = $this->query('date_from');
            $dateTo = $this->query('date_to');
            if ($dateFrom !== null && $dateTo !== null) {
                $from = DateTimeImmutable::createFromFormat('!Y-m-d', $dateFrom, new DateTimeZone('UTC'));
                $to = DateTimeImmutable::createFromFormat('!Y-m-d', $dateTo, new DateTimeZone('UTC'));

                if ($from > $to) {
                    $validator->errors()->add('date_from', 'validation.date_range_order');
                } elseif ($to > $from->modify('+5 years')) {
                    $validator->errors()->add('date_to', 'validation.date_range_max');
                }
            }

            $minimum = $this->query('min_amount_cents');
            $maximum = $this->query('max_amount_cents');
            if ($minimum !== null && $maximum !== null && (int) $minimum > (int) $maximum) {
                $validator->errors()->add('min_amount_cents', 'validation.amount_range_order');
            }
        });
    }

    public function filters(): array
    {
        return $this->validated();
    }
}
