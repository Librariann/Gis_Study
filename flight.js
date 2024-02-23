// Get your token from https://cesium.com/ion/tokens
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYWE1OWUxNy1mMWZiLTQzYjYtYTQ0OS1kMWFjYmFkNjc5YzciLCJpZCI6NTc3MzMsImlhdCI6MTYyNzg0NTE4Mn0.XcKpgANiY19MC4bdFUXMVEBToBmqS8kuYpUlxJHYZxk";

//create cesium Container
const viewer = new Cesium.Viewer("cesiumContainer", {
  terrainProvider: Cesium.createWorldTerrain(),
  shouldAnimate: false,
});

const osmBuildings = viewer.scene.primitives.add(Cesium.createOsmBuildings());

const getPathJson = async () => {
  return await fetch("./path.json").then((res) => res.json());
};

const times = [];
const positions = [];
const startTime = Cesium.JulianDate.now();

const flight = async () => {
  const airplaneUri = "./path/no1.glb";
  const flightData = await getPathJson();

  const startCoordinate = flightData[0];
  const startPosition = Cesium.Cartesian3.fromDegrees(
    startCoordinate.longitude,
    startCoordinate.latitude,
    startCoordinate.height
  );

  const targetCoordinate = flightData[2];
  const targetPosition = Cesium.Cartesian3.fromDegrees(
    targetCoordinate.longitude,
    targetCoordinate.latitude,
    targetCoordinate.height
  );

  const timeStepInSeconds = 20;
  const totalSeconds = timeStepInSeconds * (flightData.length - 1);
  const start = Cesium.JulianDate.fromDate(new Date(2019, 5, 10, 13));
  const stop = Cesium.JulianDate.addSeconds(
    start,
    timeStepInSeconds * flightData.length,
    new Cesium.JulianDate()
  );
  viewer.clock.startTime = start.clone();
  viewer.clock.stopTime = stop.clone();
  viewer.clock.currentTime = start.clone();
  viewer.timeline.zoomTo(start, stop);
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP; // Loop at the end
  // Speed up the playback speed 50x.
  viewer.clock.multiplier = 5;
  // Start playing the scene.geatigoonore
  viewer.clock.shouldAnimate = false;

  flightData.forEach((point, i) => {
    const time = Cesium.JulianDate.addSeconds(
      startTime,
      i * timeStepInSeconds,
      new Cesium.JulianDate()
    );
    const position = Cesium.Cartesian3.fromDegrees(
      point.longitude,
      point.latitude,
      point.height
    );
    times.push(Cesium.JulianDate.secondsDifference(time, startTime));
    positions.push(position);
  });

  const spline = new Cesium.CatmullRomSpline({
    times: times,
    points: positions,
  });
  const pointss = [];
  //위치값 계산
  const computePositionProperty = () => {
    const property = new Cesium.SampledPositionProperty();

    for (let t = times[0]; t <= times[times.length - 1]; t += 1) {
      const time = Cesium.JulianDate.addSeconds(
        startTime,
        t,
        new Cesium.JulianDate()
      );
      pointss.push(spline.evaluate(t));
    }

    for (let i = 0; i < flightData.length; i++) {
      const dataPoint = flightData[i];
      const time = Cesium.JulianDate.addSeconds(
        start,
        i * timeStepInSeconds,
        new Cesium.JulianDate()
      );

      const positionss = Cesium.Cartesian3.fromDegrees(
        dataPoint.longitude,
        dataPoint.latitude,
        dataPoint.height
      );

      property.addSample(time, positionss);
    }

    return property;
  };

  // 방위각 계산 함수
  function calculateCorrectBearing(startLat, startLon, endLat, endLon) {
    const startLatRad = Cesium.Math.toRadians(startLat);
    const startLonRad = Cesium.Math.toRadians(startLon);
    const endLatRad = Cesium.Math.toRadians(endLat);
    const endLonRad = Cesium.Math.toRadians(endLon);

    const dLon = endLonRad - startLonRad;

    const y = Math.sin(dLon) * Math.cos(endLatRad);
    const x =
      Math.cos(startLatRad) * Math.sin(endLatRad) -
      Math.sin(startLatRad) * Math.cos(endLatRad) * Math.cos(dLon);

    const bearing = Math.atan2(y, x);
    let bearingDegrees = Cesium.Math.toDegrees(bearing);
    bearingDegrees = (bearingDegrees + 360) % 360;

    return bearingDegrees;
  }

  viewer.entities.add({
    polyline: {
      positions: pointss,
      arcType: Cesium.ArcType.GEODESIC,
      width: 10,
      material: new Cesium.PolylineArrowMaterialProperty(Cesium.Color.YELLOW),
    },
  });

  const computeOrientation = () => {
    const property = new Cesium.SampledProperty(Cesium.Quaternion);
    let heading;
    for (let i = 0; i < flightData.length - 1; i++) {
      const time = Cesium.JulianDate.addSeconds(
        start,
        i * timeStepInSeconds,
        new Cesium.JulianDate()
      );
      const currentPosition = Cesium.Cartesian3.fromDegrees(
        flightData[i].longitude,
        flightData[i].latitude,
        flightData[i].height
      );

      if (i === 0) {
        const bearing = calculateCorrectBearing(
          startCoordinate.latitude,
          startCoordinate.longitude,
          targetCoordinate.latitude,
          targetCoordinate.longitude
        );
        heading = Cesium.Math.toRadians(bearing - 90);
        const hpr = new Cesium.HeadingPitchRoll(heading, 0.0, 0.0);
        property.addSample(
          time,
          Cesium.Transforms.headingPitchRollQuaternion(startPosition, hpr)
        );
      } else {
        const bearing = calculateCorrectBearing(
          flightData[i].latitude,
          flightData[i].longitude,
          flightData[i + 1].latitude,
          flightData[i + 1].longitude
        );
        heading = Cesium.Math.toRadians(bearing - 90);
        const hpr = new Cesium.HeadingPitchRoll(heading, 0.0, 0.0);
        property.addSample(
          time,
          Cesium.Transforms.headingPitchRollQuaternion(currentPosition, hpr)
        );
      }
    }
    return property;
  };

  const positionProperty = computePositionProperty();
  const orientationProperty = computeOrientation();
  // 비행기객체 관련 데이터 추가
  const airplaneEntity = viewer.entities.add({
    availability: new Cesium.TimeIntervalCollection([
      new Cesium.TimeInterval({ start: start, stop: stop }),
    ]),
    position: positionProperty,
    orientation: orientationProperty,

    path: {
      resolution: 1,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.1,
        color: Cesium.Color.RED,
      }),
      width: 10,
    },
    model: {
      uri: airplaneUri,
      minimumPixelSize: 64,
      maximumScale: 100,
    },
  });
  viewer.trackedEntity = airplaneEntity;

  //   viewer.scene.preRender.addEventListener(function () {
  //     var currentTime = viewer.clock.currentTime;
  //     var currentTimeString = Cesium.JulianDate.toIso8601(currentTime);
  //     // JulianDate를 Date 객체로 변환합니다.
  //     var currentDate = Cesium.JulianDate.toDate(currentTime);

  //     // Date 객체의 시간을 초 단위로 가져옵니다.
  //     var currentTimeInSeconds = Math.floor(
  //       currentDate.getTime() / 1000
  //     ).toString();

  //     if (
  //       +currentTimeInSeconds.slice(
  //         currentTimeInSeconds.length - 2,
  //         currentTimeInSeconds.length
  //       ) > timeStepInSeconds
  //     ) {
  //       const bearing = calculateCorrectBearing(
  //         flightData[2].latitude,
  //         flightData[2].longitude,
  //         flightData[3].latitude,
  //         flightData[3].longitude
  //       );
  //       const asdPosition = Cesium.Cartesian3.fromDegrees(
  //         flightData[2].longitude,
  //         flightData[2].latitude,
  //         flightData[2].height
  //       );
  //       // heading 계산
  //       const heading = Cesium.Math.toRadians(bearing - 90);
  //       // 모델의 방향 설정
  //       const hpr = new Cesium.HeadingPitchRoll(heading, 0.0, 0.0);
  //       airplaneEntity.orientation = Cesium.Transforms.headingPitchRollQuaternion(
  //         asdPosition,
  //         hpr
  //       );
  //     }
  //   });
};
flight();
