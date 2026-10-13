import { NextResponse } from "next/server";
import { getCurrentUsuario } from "@/modules/usuarios/service";

export async function GET() {
  try {
    const usuario = await getCurrentUsuario();

    if (!usuario) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "No hay una sesión de usuario activa.",
          },
        },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        id: usuario.id.toString(),
        name: usuario.name,
        apellido: usuario.apellido,
        email: usuario.email,
        roleId: usuario.roleId,
        clerkId: usuario.clerkId,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener perfil";
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "INTERNAL_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
