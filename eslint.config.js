//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'
import jsxA11y from 'eslint-plugin-jsx-a11y'

/**
 * Patrones que nombran a `src/server` en todas sus grafías posibles: relativa,
 * por alias y por el prefijo de subrutas de paquete. La regla se apoya en el
 * texto del import y no en su resolución, porque una regla que solo entiende
 * una grafía no es una frontera, es una sugerencia.
 */
const IMPORTS_DE_SERVIDOR = [
  '**/server',
  '**/server/**',
  '@server',
  '@server/**',
]

/** La puerta sancionada: los archivos que declaran funciones de servidor. */
const PUERTA_DE_SERVIDOR = ['src/**/*.funciones.ts']

const config = [
  ...tanstackConfig,

  {
    name: 'suitpay/accesibilidad',
    ...jsxA11y.flatConfigs.recommended,
    files: ['src/**/*.tsx'],
  },

  {
    name: 'suitpay/frontera-del-servidor',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: IMPORTS_DE_SERVIDOR,
              message:
                'src/server/ no se importa desde el cliente: ahí viven los secretos del proveedor y el privilegio administrativo. Alcánzalo a través de un archivo *.funciones.ts, que es la única puerta sancionada (plan.md, Structure Decision).',
            },
          ],
          paths: [
            {
              name: 'firebase-admin',
              message:
                'El Admin SDK salta todas las reglas de seguridad. Solo puede vivir en src/server/.',
            },
          ],
        },
      ],
    },
  },

  {
    // La puerta: un archivo *.funciones.ts declara funciones de servidor y el
    // cliente sí puede importarlo. El compilador de Start le quita el cuerpo y
    // sus dependencias de servidor al construir el paquete del navegador, de
    // modo que importarlo no arrastra nada privilegiado al navegador.
    name: 'suitpay/frontera-del-servidor-puerta',
    files: PUERTA_DE_SERVIDOR,
    rules: {
      '@typescript-eslint/no-restricted-imports': 'off',
    },
  },

  {
    name: 'suitpay/pureza-del-dominio',
    files: ['src/domain/**/*.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react/**',
                'react-dom',
                'react-dom/**',
                'firebase',
                'firebase/**',
                'firebase-admin',
                'firebase-admin/**',
                '@tanstack/**',
                '@radix-ui/**',
                'zustand',
                'zustand/**',
                'idb',
                'lucide-react',
                ...IMPORTS_DE_SERVIDOR,
                '**/features/**',
                '@features/**',
                '**/ui/**',
                '@ui/**',
                '**/infra/**',
                '@infra/**',
                '**/routes/**',
              ],
              message:
                'src/domain/ es puro. Existe para que el cálculo y la validación sean literalmente el mismo código en el cliente y en el servidor, y la regla "manda el servidor" solo es creíble si lo son. Solo zod y fuse.js están admitidos aquí.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'suitpay/frontera-del-proveedor',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/server/proveedor/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/proveedor/factpro', '**/proveedor/factpro/**'],
              message:
                'El adaptador del proveedor es el único lugar del sistema que lo conoce (principio III). Fuera de src/server/proveedor/ se usa la interfaz, nunca el adaptador.',
            },
          ],
        },
      ],
    },
  },

  {
    name: 'suitpay/reglas-generales',
    rules: {
      'import/no-cycle': 'off',
      'import/order': 'off',
      'sort-imports': 'off',
      '@typescript-eslint/array-type': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },

  {
    name: 'suitpay/ignorados',
    ignores: [
      'eslint.config.js',
      'prettier.config.js',
      'src/routeTree.gen.ts',
      '.output/**',
      '.nitro/**',
      '.tanstack/**',
      'dist/**',
    ],
  },
]

export default config
