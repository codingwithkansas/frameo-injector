# Utility Functions
BUILD_CONTEXT_DOCKER_IMAGE="frameo-injector-shell-ctx"
BUILD_CONTEXT_CONTAINER_NAME="frameo-injector-shell-ctx"
function get_build_ctx_docker_imagetag {
    PWD="$1"
    TAG=`cat "$PWD/Dockerfile-shell" | grep "ENV" | grep "VERSION" | sed 's/ENV VERSION=//' | tr -d '\"'`
    printf "$BUILD_CONTEXT_DOCKER_IMAGE-$TAG"
}


function clean {
    ROOT_WORKDIR="$1"
    IMAGE_NAME="$(get_build_ctx_docker_imagetag $ROOT_WORKDIR)"
    docker rm "$BUILD_CONTEXT_CONTAINER_NAME" \
        || echo "Image: $BUILD_CONTEXT_CONTAINER_NAME does not exist"
    docker image rm "$IMAGE_NAME" \
        || echo "Image: $IMAGE_NAME does not exist"
}

function build_shell {
    ROOT_WORKDIR="$1"
    IMAGE_NAME="$(get_build_ctx_docker_imagetag $ROOT_WORKDIR)"
    echo "Building build context image: $IMAGE_NAME"
    docker build -t "$IMAGE_NAME" -f "$ROOT_WORKDIR/Dockerfile-shell" "$ROOT_WORKDIR"
}

function run_shell {
    ROOT_WORKDIR="$1"
    IMAGE_NAME="$(get_build_ctx_docker_imagetag $ROOT_WORKDIR)"
    if [[ "$(docker images -q $IMAGE_NAME 2> /dev/null)" == "" ]]; then
        build_shell "$ROOT_WORKDIR" || exit 1
    fi
    (docker run -it \
        --name "$BUILD_CONTEXT_CONTAINER_NAME"  \
        -v "$ROOT_WORKDIR:/src" \
        -v "$HOME/.android:/root/.android" \
        -p "5000:5000" \
        -p "3000:3000" \
        -p "8080:8080" \
        "$IMAGE_NAME" \
        bash) && docker rm "$BUILD_CONTEXT_CONTAINER_NAME"
}