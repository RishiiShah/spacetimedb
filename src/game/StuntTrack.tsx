import { useMemo } from 'react';
import * as THREE from 'three';

export function StuntTrackAssets() {
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];

    for (let index = 0; index <= 18; index++) {
      points.push(new THREE.Vector3(0, 0, -index * 6));
    }

    const loopRadius = 24;
    const loopCenterZ = -132;
    for (let index = 0; index <= 48; index++) {
      const angle = (index / 48) * Math.PI * 2;
      points.push(
        new THREE.Vector3(
          Math.sin(angle) * 2,
          loopRadius - Math.cos(angle) * loopRadius,
          loopCenterZ + Math.sin(angle) * loopRadius
        )
      );
    }

    for (let index = 0; index <= 22; index++) {
      points.push(new THREE.Vector3(Math.sin(index * 0.35) * 18, 0, -170 - index * 10));
    }

    points.push(new THREE.Vector3(80, 0, -430));
    points.push(new THREE.Vector3(100, 0, -300));
    points.push(new THREE.Vector3(70, 0, -120));
    points.push(new THREE.Vector3(0, 0, 0));

    const curve = new THREE.CatmullRomCurve3(points, true);
    const shape = new THREE.Shape();
    shape.moveTo(-10, -0.45);
    shape.lineTo(10, -0.45);
    shape.lineTo(10, 0.45);
    shape.lineTo(-10, 0.45);

    return new THREE.ExtrudeGeometry(shape, {
      steps: 520,
      bevelEnabled: false,
      extrudePath: curve,
    });
  }, []);

  return (
    <>
      <mesh receiveShadow rotation-x={-Math.PI / 2} position={[0, -0.12, -230]}>
        <planeGeometry args={[320, 560]} />
        <meshStandardMaterial color="#5c8058" roughness={0.96} />
      </mesh>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color="#30343a" roughness={0.8} />
      </mesh>
      <mesh geometry={geometry}>
        <meshStandardMaterial color="#facc15" wireframe transparent opacity={0.08} />
      </mesh>
    </>
  );
}
