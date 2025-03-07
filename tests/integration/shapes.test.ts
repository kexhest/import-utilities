import 'dotenv/config'
import test from 'ava'
import { v4 } from 'uuid'
import {
  deleteTenantMutation,
  tenant,
} from '@crystallize/import-export-sdk/tenant'
import { Tenant } from '@crystallize/schema/tenant'
import { Bootstrapper, EVENT_NAMES } from '../../src/index'
import {
  ClientInterface,
  createClient,
  createMassCallClient,
} from '@crystallize/js-api-client'
import { fail } from 'assert'
import { getManyShapesQuery } from '@crystallize/import-export-sdk/shape'
import { Shape, ShapeComponent } from '@crystallize/schema/shape'
import { validateObject } from './_utils'
import { BootstrapperError } from '../../src/bootstrap-tenant/bootstrapper'

const { DEV_CRYSTALLIZE_ACCESS_TOKEN_ID, DEV_CRYSTALLIZE_ACCESS_TOKEN_SECRET } =
  process.env

if (!DEV_CRYSTALLIZE_ACCESS_TOKEN_ID || !DEV_CRYSTALLIZE_ACCESS_TOKEN_SECRET) {
  throw new Error('access token not set')
}

interface TestCase {
  name: string
  shapes: Shape[]
}

interface TestContext {
  tenant: Tenant
  client: ClientInterface
}

const testCases: TestCase[] = [
  {
    name: 'Creates basic shapes',
    shapes: [
      {
        identifier: 'test-folder-0',
        name: 'Test Folder 0',
        type: 'folder',
      },
      {
        identifier: 'test-product-0',
        name: 'Test Product 0',
        type: 'product',
      },
    ],
  },
  {
    name: 'Creates a shape with basic components',
    shapes: [
      {
        identifier: 'test-folder-1',
        name: 'Test Folder 1',
        type: 'folder',
        components: [
          {
            id: 'text',
            name: 'Text',
            description: 'A single line component',
            type: 'singleLine',
          },
          {
            id: 'number',
            name: 'Number',
            type: 'numeric',
            config: {
              decimalPlaces: 5,
              units: ['g', 'kg'],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Creates a shape with basic variant components',
    shapes: [
      {
        identifier: 'test-product-2',
        name: 'Test Product 2',
        type: 'product',
        variantComponents: [
          {
            id: 'text',
            name: 'Text',
            description: 'A single line component',
            type: 'singleLine',
          },
          {
            id: 'number',
            name: 'Number',
            type: 'numeric',
            config: {
              decimalPlaces: 5,
              units: ['g', 'kg'],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Creates a shape with both shape and variant components',
    shapes: [
      {
        identifier: 'test-product-3',
        name: 'Test Product 3',
        type: 'product',
        components: [
          {
            id: 'text',
            name: 'Text',
            description: 'A single line component',
            type: 'singleLine',
          },
        ],
        variantComponents: [
          {
            id: 'text',
            name: 'Text',
            description: 'A single line component',
            type: 'singleLine',
          },
        ],
      },
    ],
  },
  {
    name: 'Creates a shape with structural components',
    shapes: [
      {
        identifier: 'test-folder-4',
        name: 'Test Folder 4',
        type: 'folder',
        components: [
          {
            id: 'chunk',
            name: 'Chunk',
            type: 'contentChunk',
            config: {
              repeatable: true,
              components: [
                {
                  id: 'text',
                  name: 'Text',
                  description: 'A single line component',
                  type: 'singleLine',
                },
              ],
            },
          },
          {
            id: 'choice',
            name: 'Choice',
            type: 'componentChoice',
            config: {
              choices: [
                {
                  id: 'number',
                  name: 'Number',
                  type: 'numeric',
                  config: {
                    decimalPlaces: 5,
                    units: ['g', 'kg'],
                  },
                },
                {
                  id: 'text',
                  name: 'Text',
                  type: 'singleLine',
                },
              ],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Creates a shape with components with enums in config',
    shapes: [
      {
        identifier: 'test-folder-5',
        name: 'Test Folder 5',
        type: 'folder',
        components: [
          {
            id: 'files',
            name: 'files',
            type: 'files',
            config: {
              min: 1,
              max: 5,
              maxFileSize: {
                size: 20,
                unit: 'MiB',
              },
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Creates shapes with relations to one another',
    shapes: [
      {
        identifier: 'test-folder-6',
        name: 'Test Folder 6',
        type: 'folder',
        components: [
          {
            id: 'relation',
            name: 'relation',
            type: 'itemRelations',
            config: {
              acceptedShapeIdentifiers: ['test-product-7'],
            },
          },
        ],
      },
      {
        identifier: 'test-product-7',
        name: 'Test Product 7',
        type: 'product',
        components: [
          {
            id: 'relation',
            name: 'relation',
            type: 'itemRelations',
            config: {
              acceptedShapeIdentifiers: ['test-folder-6'],
            },
          },
        ],
      },
    ],
  },
  {
    name: 'Creates a shape with relations in structural components',
    shapes: [
      {
        identifier: 'test-folder-8',
        name: 'Test Folder 8',
        type: 'folder',
        components: [
          {
            id: 'chunk',
            name: 'Chunk',
            type: 'contentChunk',
            config: {
              components: [
                {
                  id: 'relation',
                  name: 'relation',
                  type: 'itemRelations',
                  config: {
                    acceptedShapeIdentifiers: ['test-product-9'],
                  },
                },
              ],
            },
          },
        ],
      },
      {
        identifier: 'test-product-9',
        name: 'Test Product 9',
        type: 'product',
        components: [
          {
            id: 'choice',
            name: 'Choice',
            type: 'componentChoice',
            config: {
              choices: [
                {
                  id: 'relation',
                  name: 'relation',
                  type: 'itemRelations',
                  config: {
                    acceptedShapeIdentifiers: ['test-folder-8'],
                  },
                },
                {
                  id: 'text',
                  name: 'Text',
                  type: 'singleLine',
                },
              ],
            },
          },
        ],
      },
    ],
  },
]

test.beforeEach(async (t) => {
  const identifier = `import-utilities-test-${v4()}`

  const client = createClient({
    tenantIdentifier: identifier,
    accessTokenId: DEV_CRYSTALLIZE_ACCESS_TOKEN_ID,
    accessTokenSecret: DEV_CRYSTALLIZE_ACCESS_TOKEN_SECRET,
    origin: '-dev.crystallize.digital',
  })

  const res = await tenant({
    identifier,
    name: `Import Utilities Test (${identifier})`,
    shapes: [],
  }).execute(createMassCallClient(client, {}))

  if (!res) {
    fail('failed to create tenant')
  }

  console.log(`Created tenant ${res.identifier} (${res.id})`)

  t.context = {
    tenant: res,
    client,
  }
})

test.afterEach.always(async (t) => {
  const ctx = t.context as TestContext
  const { query, variables } = deleteTenantMutation({ id: ctx.tenant.id })
  await ctx.client.pimApi(query, variables)
  console.log(`Deleted tenant ${ctx.tenant.identifier} (${ctx.tenant.id})`)
})

testCases.forEach((tc) => {
  test(tc.name, async (t) => {
    const ctx = t.context as TestContext

    const bootstrapper = new Bootstrapper()
    bootstrapper.env = 'dev'
    bootstrapper.setTenantIdentifier(ctx.tenant.identifier)
    bootstrapper.setAccessToken(
      DEV_CRYSTALLIZE_ACCESS_TOKEN_ID,
      DEV_CRYSTALLIZE_ACCESS_TOKEN_SECRET
    )

    bootstrapper.setSpec({
      shapes: tc.shapes,
    })

    bootstrapper.on(EVENT_NAMES.ERROR, (err: BootstrapperError) => {
      if (!err.willRetry) {
        fail(err.error)
      }
    })
    await bootstrapper.start()

    const { query, variables } = getManyShapesQuery(
      { tenantId: ctx.tenant.id },
      { includeComponents: true }
    )
    const res = await ctx.client
      .pimApi(query, variables)
      .then((res) => res?.shape?.getMany)

    if (!res) {
      return fail('failed to fetch shapes for tenant')
    }

    const shapes = res as Shape[]
    t.is(shapes.length, tc.shapes.length)

    tc.shapes.forEach((input) => {
      const shape = shapes.find(
        ({ identifier }) => input.identifier === identifier
      )
      if (!shape) {
        return fail(`shape with identifier ${input.identifier} was not created`)
      }

      t.is(shape.identifier, input.identifier)
      t.is(shape.name, input.name)

      t.is(shape.components?.length, input.components?.length)
      t.is(shape.variantComponents?.length, input.variantComponents?.length)

      const validateComponent = (
        input: ShapeComponent,
        components: ShapeComponent[]
      ) => {
        const actual = components.find(({ id }) => input.id === id)
        if (!actual) {
          fail(`missing component ${input.id} in the response`)
        }

        validateObject(t, actual, input)
      }

      input.components?.forEach((cmp) =>
        validateComponent(cmp, input.components as ShapeComponent[])
      )
      input.variantComponents?.forEach((cmp) =>
        validateComponent(cmp, input.variantComponents as ShapeComponent[])
      )
    })
  })
})
