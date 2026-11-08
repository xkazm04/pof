import { describe, it, expect, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { POST, PUT, DELETE } from '@/app/api/visual-gen/materials/route';
import { deleteMaterial } from '@/lib/visual-gen/material-db';

const raw = (method: string, body: string) => new NextRequest('http://localhost/api/visual-gen/materials', { method, body });
const json = (method: string, body: unknown) => raw(method, JSON.stringify(body));

const created: string[] = [];
afterAll(() => created.forEach((id) => deleteMaterial(id)));

describe('materials route classifies caller mistakes', () => {
  for (const body of ['{nope', 'null', '[1]']) {
    it(`POST, PUT and DELETE answer 400 for ${body}`, async () => {
      expect((await POST(raw('POST', body))).status).toBe(400);
      expect((await PUT(raw('PUT', body))).status).toBe(400);
      expect((await DELETE(raw('DELETE', body))).status).toBe(400);
    });
  }

  it.each([
    ['POST id', () => POST(json('POST', { id: { a: 1 }, name: 'n', params: {} }))],
    ['POST name', () => POST(json('POST', { id: 'x', name: { a: 1 }, params: {} }))],
    ['PUT id', () => PUT(json('PUT', { id: { a: 1 } }))],
    ['PUT name', () => PUT(json('PUT', { id: 'x', name: { a: 1 } }))],
    ['DELETE id', () => DELETE(json('DELETE', { id: { a: 1 } }))],
  ])('refuses a non-string %s', async (_l, call) => {
    expect((await call()).status).toBe(400);
  });

  it('answers 409 for an id that already exists, keeping the original', async () => {
    const id = randomUUID();
    created.push(id);
    expect((await POST(json('POST', { id, name: 'first', params: {} }))).status).toBe(201);
    expect((await POST(json('POST', { id, name: 'second', params: {} }))).status).toBe(409);
    const put = await PUT(json('PUT', { id }));
    expect((await put.json()).data.name).toBe('first');
  });
});
