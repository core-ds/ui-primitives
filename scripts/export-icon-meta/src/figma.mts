import { GetFileComponentSetsResponse, GetFileComponentsResponse } from '@figma/rest-api-spec';

export async function getFileComponents(fileKey: string): Promise<GetFileComponentsResponse> {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/components`, {
        headers: { 'X-FIGMA-TOKEN': process.env.FIGMA_TOKEN },
    });
    const json = (await response.json()) as GetFileComponentsResponse;

    return json;
}

export async function getFileComponentSets(fileKey: string): Promise<GetFileComponentSetsResponse> {
    const response = await fetch(`https://api.figma.com/v1/files/${fileKey}/component_sets`, {
        headers: { 'X-FIGMA-TOKEN': process.env.FIGMA_TOKEN },
    });
    const json = (await response.json()) as GetFileComponentSetsResponse;

    return json;
}
