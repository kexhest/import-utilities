import { jsonToGraphQLQuery } from 'json-to-graphql-query'
import { ShapeInput } from '../types'

export const buildCreateShapeMutation = (input: ShapeInput): string => {
  const mutation = {
    mutation: {
      shape: {
        create: {
          __args: {
            input,
          },
          id: true,
          name: true,
        },
      },
    },
  }

  return jsonToGraphQLQuery(mutation)
}
