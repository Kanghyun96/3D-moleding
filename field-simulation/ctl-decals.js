    function drawBobcatHeadIcon(g, cx, cy, size, color) {
      g.save();
      g.translate(cx, cy);
      const s = size / 100;
      g.scale(s, s);
      g.fillStyle = color;

      // Bobcat 시그니처 기하학적 고양이(Lynx/Bobcat) 헤드 실루엣
      g.beginPath();
      g.moveTo(-42, -18);
      g.lineTo(-48, -46); // 좌측 귀 끝
      g.lineTo(-20, -30);
      g.lineTo(12, -30);
      g.lineTo(38, -46);  // 우측 귀 끝
      g.lineTo(34, -16);
      g.lineTo(48, 2);    // 우측 볼 털(Cheek tuft)
      g.lineTo(30, 18);
      g.lineTo(38, 28);
      g.lineTo(14, 38);   // 턱 끝
      g.lineTo(-16, 38);
      g.lineTo(-34, 24);
      g.lineTo(-48, 6);   // 좌측 볼 털
      g.closePath();
      g.fill();

      // 눈 & 코 음각 컷아웃 (바탕색으로 비우기)
      g.globalCompositeOperation = 'destination-out';
      // 좌측 눈
      g.beginPath();
      g.moveTo(-24, -8); g.lineTo(-6, -2); g.lineTo(-18, 4); g.closePath();
      g.fill();
      // 우측 눈
      g.beginPath();
      g.moveTo(22, -8); g.lineTo(6, -2); g.lineTo(18, 4); g.closePath();
      g.fill();
      // 코 & 입 라인
      g.beginPath();
      g.moveTo(-8, 14); g.lineTo(8, 14); g.lineTo(0, 24); g.closePath();
      g.fill();

      g.restore();
    }

    // 1) 후면 오렌지 테일게이트 전용 고해상도 텍스처 (512 x 280)
    const rearDecalCanvas = document.createElement('canvas');
    rearDecalCanvas.width = 512;
    rearDecalCanvas.height = 280;
    (function buildRearDecal() {
      const g = rearDecalCanvas.getContext('2d');
      // 오렌지 도어 베이스 그라데이션
      const grad = g.createLinearGradient(0, 0, 0, 280);
      grad.addColorStop(0, '#f97316');
      grad.addColorStop(0.5, '#ea580c');
      grad.addColorStop(1, '#c2410c');
      g.fillStyle = grad;
      g.fillRect(0, 0, 512, 280);

      // 외곽 다크 프레임 몰딩
      g.strokeStyle = '#1e2228';
      g.lineWidth = 10;
      g.strokeRect(5, 5, 502, 270);

      // 상단 가로 음각 라인 & 우측 모델 배지 포켓 (레퍼런스 사진 상단 검은 바 + 흰색 배지)
      g.fillStyle = '#23272e';
      g.beginPath();
      g.roundRect(36, 34, 440, 44, 8);
      g.fill();

      // 상단 좌측 리어 테일램프 (붉은 LED) & 우측 은색/흰색 모델명 배지
      g.fillStyle = '#dc2626';
      g.fillRect(52, 46, 46, 18);
      g.fillStyle = '#f8fafc';
      g.fillRect(356, 45, 58, 20);
      g.fillStyle = '#0f172a';
      g.font = '900 13px "Pretendard", "Segoe UI", sans-serif';
      g.fillText('T-870', 371, 60);

      // 우측 도어 래치 핸들
      g.fillStyle = '#94a3b8';
      g.fillRect(432, 46, 26, 18);

      // 중앙 하단: 흰색 Bobcat 고양이 헤드 로고 + "Bobcat" 굵은 레터링 (크고 선명하게!)
      drawBobcatHeadIcon(g, 118, 182, 108, '#ffffff');

      g.fillStyle = '#ffffff';
      g.font = 'italic 900 82px "Arial Black", "Pretendard", Impact, sans-serif';
      g.fillText('Bobcat', 178, 210);
    })();

    // 2) 측면 화이트 리프트 암 전용 데칼 텍스처 (520 x 160)
    function createSideArmDecal(isRightSide) {
      const c = document.createElement('canvas');
      c.width = 520;
      c.height = 160;
      const g = c.getContext('2d');

      // 순백색 화이트 프레임 바탕 + 상하 테두리 강조
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, 520, 160);
      g.strokeStyle = '#cbd5e1';
      g.lineWidth = 6;
      g.strokeRect(3, 3, 514, 154);

      // 레퍼런스 사진의 측면 오렌지 & 차콜 스트라이프 라인
      g.fillStyle = '#1e2228';
      g.beginPath();
      if (!isRightSide) {
        g.moveTo(210, 46); g.lineTo(490, 46); g.lineTo(470, 78); g.lineTo(195, 78);
      } else {
        g.moveTo(30, 46); g.lineTo(310, 46); g.lineTo(325, 78); g.lineTo(50, 78);
      }
      g.closePath();
      g.fill();

      g.fillStyle = '#ea580c';
      g.beginPath();
      if (!isRightSide) {
        g.moveTo(200, 84); g.lineTo(465, 84); g.lineTo(450, 112); g.lineTo(188, 112);
      } else {
        g.moveTo(55, 84); g.lineTo(320, 84); g.lineTo(332, 112); g.lineTo(70, 112);
      }
      g.closePath();
      g.fill();

      // 후방 측면 Bobcat 고양이 아이콘 + Bobcat 텍스트 + 오렌지 모델 배지 (크기 확대)
      const baseX = isRightSide ? 335 : 16;
      drawBobcatHeadIcon(g, baseX + 26, 62, 46, '#111827');
      g.fillStyle = '#111827';
      g.font = 'italic 900 32px "Arial Black", "Pretendard", sans-serif';
      g.fillText('Bobcat', baseX + 52, 74);

      // 하단 오렌지 모델 스트립 (T76)
      g.fillStyle = '#ea580c';
      g.fillRect(baseX + 52, 84, 96, 26);
      g.fillStyle = '#ffffff';
      g.font = '900 17px "Arial Black", "Pretendard", sans-serif';
      g.fillText('T-870', baseX + 80, 103);

      return c;
    }
    const leftArmDecal = createSideArmDecal(false);
    const rightArmDecal = createSideArmDecal(true);


export { rearDecalCanvas, leftArmDecal, rightArmDecal };
