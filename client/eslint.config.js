import eslint from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const i18next = {
  rules: {
    'no-literal-string': {
      meta: {
        type: 'problem',
        docs: {
          description: 'Disallow user-facing literal strings outside i18n helpers.',
        },
        schema: [{
          type: 'object',
          properties: {
            ignore: { type: 'array', items: { type: 'string' } },
            ignoreCallee: { type: 'array', items: { type: 'string' } },
          },
          additionalProperties: false,
        }],
        messages: {
          literalString: 'User-visible text should use i18n instead of the literal string "{{text}}".',
        },
      },
      create(context) {
        const options = context.options[0] ?? {}
        const ignoreCallee = new Set((options.ignoreCallee ?? []).map(String))
        const ignorePatterns = (options.ignore ?? []).map((value) => new RegExp(String(value), 'i'))
        const contentFile = context.filename.replaceAll('\\', '/').includes('/src/content/')

        function normalize(value) {
          return String(value).replace(/\s+/g, ' ').trim()
        }

        function isIgnored(value) {
          const cleaned = normalize(value)
          return cleaned.length === 0 || ignorePatterns.some((pattern) => pattern.test(cleaned))
        }

        function isAllowedCall(node) {
          if (!node || node.type !== 'CallExpression') return false

          if (node.callee.type === 'Identifier') return ignoreCallee.has(node.callee.name)
          if (node.callee.type === 'MemberExpression' && node.callee.property.type === 'Identifier') {
            return ignoreCallee.has(`${node.callee.property.name}`) || (
              node.callee.object.type === 'Identifier' && ignoreCallee.has(`${node.callee.object.name}.${node.callee.property.name}`)
            )
          }

          return false
        }

        function hasAllowedCallAncestor(node) {
          let current = node.parent
          while (current) {
            if (isAllowedCall(current)) return true
            if (current.type === 'JSXElement' || current.type === 'FunctionDeclaration' || current.type === 'ArrowFunctionExpression') return false
            current = current.parent
          }
          return false
        }

        function isInsideJsxExpression(node) {
          let current = node.parent
          while (current) {
            if (current.type === 'JSXExpressionContainer') return true
            if (current.type === 'JSXElement' || current.type === 'FunctionDeclaration' || current.type === 'ArrowFunctionExpression') return false
            current = current.parent
          }
          return false
        }

        function reportString(node, value) {
          if (!value || isIgnored(value)) return
          const cleaned = normalize(value)
          if (cleaned.length < 2 || !/[A-Za-z]/.test(cleaned)) return
          context.report({ node, messageId: 'literalString', data: { text: cleaned } })
        }

        return {
          JSXText(node) {
            reportString(node, node.value)
          },
          JSXAttribute(node) {
            if (!node.name || node.name.type !== 'JSXIdentifier') return
            const names = new Set(['alt', 'aria-label', 'title', 'placeholder', 'label'])
            if (!names.has(node.name.name)) return
            if (node.value && node.value.type === 'Literal' && typeof node.value.value === 'string') {
              reportString(node, node.value.value)
            }
          },
          Literal(node) {
            if (typeof node.value !== 'string') return
            if (node.parent && node.parent.type === 'Property' && node.parent.key === node && !node.parent.computed) return
            if (node.parent && node.parent.type === 'ImportDeclaration') return
            if (node.parent && node.parent.type === 'ExportDefaultDeclaration') return
            if (hasAllowedCallAncestor(node)) return
            if (!contentFile && !isInsideJsxExpression(node)) {
              const parent = node.parent
              const isVisibleCall = parent?.type === 'CallExpression' && parent.arguments.includes(node) && (
                parent.callee.type === 'Identifier' && ['toast', 'setError'].includes(parent.callee.name)
              )
              const isTitleAssignment = parent?.type === 'AssignmentExpression' && parent.left.type === 'MemberExpression' &&
                parent.left.property.type === 'Identifier' && parent.left.property.name === 'title'
              if (!isVisibleCall && !isTitleAssignment) return
            }
            reportString(node, node.value)
          },
          TemplateLiteral(node) {
            if (hasAllowedCallAncestor(node)) return
            if (!contentFile && !isInsideJsxExpression(node)) return
            reportString(node, node.quasis.map((quasi) => quasi.value.cooked ?? quasi.value.raw).join(''))
          },
        }
      },
    },
  },
}

// ESLint checks TypeScript source using the supported flat configuration.
export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/pages/Design.tsx', 'src/content/design-system.ts', 'src/**/*.d.ts'] },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: {
      i18next,
    },
    rules: {
      'i18next/no-literal-string': ['error', {
        ignoreCallee: ['t', 'adminT', 'useTranslation', 'cn', 'clsx'],
        ignore: [
          '^Westbridge National Bank$',
          '^Westbridge$',
          '^National Bank$',
          '^Demo only\\. Westbridge National Bank is not a real bank\\. No real money is held\\.$',
          '^/images/',
          '^/videos/',
          '^var\\(--[a-z0-9-]+\\)$',
          '^#[0-9a-f]{3,8}$',
          '^(?:high|auto|eager|lazy)$',
          '^(?:aria-label|article)$',
          '^language-option-$',
          '^(?:w-full|relative|outline)$',
          '^(?:lg|hero-card-[a-z-]+)$',
          '^/products#$',
          '^Payroll$',
          '^(?:start|url\\(\\)|cta-banner)$',
          '^/blog/$',
          '^(?:contact-name-error|contact-email-error|contact-subject-error|contact-message-error|newsletter-email-error)$',
          '^(?:Elena Brooks|Marcus Chen|Priya Nair)$',
          '^[a-z0-9]+(?:-[a-z0-9]+)*$',
          '^/[a-z0-9#?/-]+$',
          '^(?:-title|-rates-heading|faq-)$',
          '^(?:size-3\\.5 text-primary|size-3\\.5)$',
          '^/login\\?redirect=$',
          '^auth\\.errors\\.(?:sendReset|resetPassword|createAccount)$',
          '^#how-it-works$',
          '^18K\\+$',
          '^(?:Alicia R\\.|Jordan L\\.|Maya P\\.|Theo N\\.|Sofia K\\.|Daniel B\\.)$',
          '^(?:transactions\\.(?:description|user|direction|category|amount|account)|users\\.(?:name|status|role|verified|accounts|balance|created)|audit\\.actions\\.)',
          '^(?:created_at|last_login_at|bill_payment|in_progress)$',
          '^/admin/support\\?user_id=',
          '^(?:inline-flex items-center gap-1 border px-2 py-1 text-xs font-semibold|border-destructive text-destructive|border-primary text-primary|border-border text-muted-foreground|px-3 py-3 align-middle|border-s-2 p-3|border-primary bg-muted)$',
          '^/[a-z0-9_#?/-]+$',
          '^admin-$',
        ],
      }],
    },
  },
  {
    files: ['scripts/**/*.{js,mjs}'],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
)