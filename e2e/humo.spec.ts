import { test, expect } from '@playwright/test';

/**
 * Pruebas de humo de la aplicación multiempresa.
 *
 * Verifican que el esqueleto responde y que las decisiones de accesibilidad
 * están en su sitio. Los recorridos de negocio llegan en fases posteriores.
 */

test.describe('sitio público', () => {
  test('la portada de la plataforma carga y permite iniciar sesión', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('el idioma declarado es español de México', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es-MX');
  });

  test('el primer tabulador lleva al salto de contenido', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: /saltar al contenido/i })).toBeFocused();
  });

  test('la sonda de salud responde', async ({ request }) => {
    const respuesta = await request.get('/api/health');
    expect(respuesta.ok()).toBeTruthy();
    expect(await respuesta.json()).toMatchObject({ estado: 'ok', servicio: 'barberia-os' });
  });

  test('una ruta inexistente muestra el 404 propio', async ({ page }) => {
    const respuesta = await page.goto('/esta-ruta-no-existe');
    expect(respuesta?.status()).toBe(404);
    await expect(page.getByText(/esta página no existe/i)).toBeVisible();
  });
});

test.describe('cabeceras de seguridad', () => {
  test('se envían las cabeceras configuradas en next.config.ts', async ({ request }) => {
    const respuesta = await request.get('/');
    const cabeceras = respuesta.headers();
    expect(cabeceras['x-frame-options']).toBe('DENY');
    expect(cabeceras['x-content-type-options']).toBe('nosniff');
    expect(cabeceras['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(cabeceras['referrer-policy']).toBe('strict-origin-when-cross-origin');
  });
});

test.describe('acceso', () => {
  test('la pantalla de acceso está disponible', async ({ page }) => {
    await page.goto('/iniciar-sesion');
    await expect(page.getByRole('heading', { name: /iniciar sesión/i })).toBeVisible();
  });

  test('la recuperación de contraseña está disponible', async ({ page }) => {
    await page.goto('/recuperar-contrasena');
    await expect(page.getByRole('heading', { name: /recuperar contraseña/i })).toBeVisible();
  });
});
